from fastapi import APIRouter, HTTPException
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth.utils import hash_password, verify_password
from app.auth.service import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

fake_db = {}

@router.post("/register")
def register(data: RegisterRequest):
    if data.email in fake_db:
        raise HTTPException(409, "User already registered")

    fake_db[data.email] = hash_password(data.password)
    return {"msg": "User created"}

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    user = fake_db.get(data.email)
    if not user or not verify_password(data.password, user):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": data.email})
    return {"access_token": token}
