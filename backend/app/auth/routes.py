import os
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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


class UpdateProfileRequest(BaseModel):
    name: str

@router.put("/me")
def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user profile (name)."""
    current_user.name = data.name
    db.commit()
    db.refresh(current_user)
    return {
        "msg": "Profile updated",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "is_active": current_user.is_active,
        }
    }


# ── Google OAuth ─────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    credential: str  # Google access token from frontend
    email: str       # User email from Google
    name: str = "Google User"  # User name from Google

@router.post("/google")
def google_auth(req: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    """
    Verify Google access token and login or register the user.
    Frontend sends access_token + user info from Google.
    """
    import urllib.request
    import json as json_mod

    try:
        # Verify the access token by calling Google's userinfo endpoint
        if req.credential == "mock_token":
            # Mock bypass for testing without real credentials
            google_user = {"email": req.email, "name": req.name, "email_verified": True}
        else:
            google_req = urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {req.credential}"}
            )
            with urllib.request.urlopen(google_req, timeout=10) as resp:
                google_user = json_mod.loads(resp.read().decode())

        email = google_user.get("email", req.email)
        name = google_user.get("name", req.name)

        if not email:
            raise HTTPException(status_code=400, detail="Google account has no email")

        if not google_user.get("email_verified", False):
            raise HTTPException(status_code=400, detail="Google email not verified")

    except urllib.error.HTTPError:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Google verification failed: {str(e)}")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log_audit(db,
                  action="GOOGLE_SIGNUP",
                  actor_id=user.id,
                  resource_type="user",
                  resource_id=str(user.id),
                  ip_address=request.client.host if request.client else None,
                  metadata={"email": email, "provider": "google"},
                  )

    # Generate tokens
    access = create_access_token({"sub": str(user.id)})
    refresh_token_str, refresh_expires = create_refresh_token(user.id)

    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=refresh_expires,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(rt)
    db.commit()

    log_audit(db,
              action="GOOGLE_LOGIN",
              actor_id=user.id,
              resource_type="user",
              resource_id=str(user.id),
              ip_address=request.client.host if request.client else None,
              metadata={"email": email},
              )

    return {
        "access_token": access,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
    }


# ── Forgot Password ─────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: str

def _send_reset_email(to_email: str, reset_token: str):
    """Send password reset email via SMTP."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_user or smtp_user == "your-email@gmail.com":
        print(f"[FORGOT PASSWORD] SMTP not configured. Reset token for {to_email}: {reset_token}")
        return False

    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your MergerMindAI password"
    msg["From"] = smtp_from
    msg["To"] = to_email

    html = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h2 style="font-size: 20px; color: #000; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            You requested a password reset for your MergerMindAI account.
            Click the button below to set a new password. This link expires in 15 minutes.
        </p>
        <a href="{reset_link}" style="display: inline-block; background: #000; color: #fff;
           padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Reset Password
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
            If you didn't request this, please ignore this email.
        </p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[SMTP ERROR] {e}")
        return False


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Request a password reset link.
    Always returns success to prevent email enumeration.
    """
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        # Generate a reset token
        reset_token = secrets.token_urlsafe(32)
        # Store in DB with 15 mins expiry
        user.reset_token = reset_token
        user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
        db.commit()

        # Send email
        _send_reset_email(req.email, reset_token)
        log_audit(db,
                  action="PASSWORD_RESET_REQUESTED",
                  actor_id=user.id,
                  resource_type="user",
                  resource_id=str(user.id),
                  ip_address=request.client.host if request.client else None,
                  metadata={"email": req.email},
                  )
    return {"message": "If an account exists with that email, a reset link has been sent."}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Verify reset token and update password.
    """
    user = db.query(User).filter(User.reset_token == req.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        
    if user.reset_token_expiry and datetime.utcnow() > user.reset_token_expiry:
        # Clear expired token
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="Expired reset token. Please request a new one.")
        
    # Valid token, update password
    user.password_hash = hash_password(req.new_password)
    user.reset_token = None # Clear token
    user.reset_token_expiry = None
    db.commit()
    
    log_audit(db,
              action="PASSWORD_RESET_SUCCESS",
              actor_id=user.id,
              resource_type="user",
              resource_id=str(user.id),
              ip_address=request.client.host if request.client else None,
              metadata={"email": user.email},
              )
              
    return {"message": "Password successfully reset."}
