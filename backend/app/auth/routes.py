from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.auth.schemas import RegisterRequest, TokenResponse
from app.auth.utils import hash_password, verify_password
from app.auth.service import (
    create_access_token, create_refresh_token,
    verify_refresh_token, get_current_user,
)
from app.auth.rate_limit import check_rate_limit
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ──────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str


class FullTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# ── Register ─────────────────────────────────────────────

@router.post("/register")
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, "register")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(409, "User already registered")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()

    log_audit(db, "REGISTER", user.id, ip_address=request.client.host, email=data.email)
    db.commit()
    db.refresh(user)
    return {"msg": "User created", "user_id": user.id}


# ── Login ────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Login with email & password → returns access_token (for Swagger).
    Also sets a refresh_token in the response body.

    In Swagger Authorize dialog → put your EMAIL in the 'username' field.
    """
    check_rate_limit(request, "login")

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(401, "Invalid credentials")

    # check account lock
    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        raise HTTPException(423, f"Account locked. Try again in {remaining} minutes.")

    if not verify_password(form_data.password, user.password_hash):
        # increment failed attempts
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.ACCOUNT_LOCK_THRESHOLD:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.ACCOUNT_LOCK_DURATION_MINUTES)
            log_audit(db, "ACCOUNT_LOCKED", user.id, ip_address=request.client.host,
                      failed_attempts=user.failed_login_attempts)
        db.commit()
        raise HTTPException(401, "Invalid credentials")

    # reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None

    # check if user is active
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")

    # create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token_str, refresh_expires = create_refresh_token(user.id)

    # store refresh token in DB
    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=refresh_expires,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(rt)

    log_audit(db, "LOGIN", user.id, ip_address=request.client.host)
    db.commit()

    return {"access_token": access_token}


# ── Login Full (returns both tokens) ─────────────────────

@router.post("/login/full", response_model=FullTokenResponse)
def login_full(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Login → returns both access_token AND refresh_token.
    Use this from the frontend instead of /auth/login.
    """
    check_rate_limit(request, "login")

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(401, "Invalid credentials")

    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        raise HTTPException(423, f"Account locked. Try again in {remaining} minutes.")

    if not verify_password(form_data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.ACCOUNT_LOCK_THRESHOLD:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.ACCOUNT_LOCK_DURATION_MINUTES)
        db.commit()
        raise HTTPException(401, "Invalid credentials")

    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")

    user.failed_login_attempts = 0
    user.locked_until = None

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token_str, refresh_expires = create_refresh_token(user.id)

    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=refresh_expires,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(rt)

    log_audit(db, "LOGIN", user.id, ip_address=request.client.host)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ── Refresh ──────────────────────────────────────────────

@router.post("/refresh", response_model=FullTokenResponse)
def refresh_access_token(data: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token + refresh token (rotation)."""
    payload = verify_refresh_token(data.refresh_token)
    user_id = int(payload["sub"])

    # check token exists and is not revoked
    stored = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.is_revoked == False,  # noqa: E712
    ).first()
    if not stored:
        raise HTTPException(401, "Refresh token revoked or not found")
    if stored.expires_at < datetime.utcnow():
        raise HTTPException(401, "Refresh token expired")

    # revoke old refresh token (rotation)
    stored.is_revoked = True
    stored.revoked_at = datetime.utcnow()

    # issue new pair
    new_access = create_access_token({"sub": str(user_id)})
    new_refresh_str, new_refresh_expires = create_refresh_token(user_id)

    new_rt = RefreshToken(
        user_id=user_id,
        token=new_refresh_str,
        expires_at=new_refresh_expires,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(new_rt)

    log_audit(db, "TOKEN_REFRESH", user_id, ip_address=request.client.host)
    db.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh_str,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ── Logout ───────────────────────────────────────────────

@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke ALL refresh tokens for the current user (logout from all devices)."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,  # noqa: E712
    ).update({"is_revoked": True, "revoked_at": datetime.utcnow()})

    log_audit(db, "LOGOUT", current_user.id, ip_address=request.client.host)
    db.commit()
    return {"msg": "Logged out — all refresh tokens revoked"}


# ── Who am I ─────────────────────────────────────────────

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user profile."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }
