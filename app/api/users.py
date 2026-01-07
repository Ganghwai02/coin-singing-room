from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, date
from app.database import get_db
from app.moddels import User
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.config import settings
from pydantic import BaseModel, EmailStr

router = APIRouter()

# Pydantic 스키마
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_premium: bool
    daily_plays_left: int


    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# 회원가입
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    # 이메일 중복 체크
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다"
        )
    
    # 사용자 생성
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        is_premium=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        **new_user.__dict__,
        "daily_plays_left": 3  # 무료 사용자 일일 3곡
    }

# 로그인
@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """로그인"""
    # 사용자 찾기
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # JWT 토큰 생성
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    
    # 오늘 재생 횟수 계산 (간단히 3으로 설정, 나중에 DB에서 조회)
    daily_plays_left = 999 if user.is_premium else 3
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            **user.__dict__,
            "daily_plays_left": daily_plays_left
        }
    }

# 내 정보 조회
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    daily_plays_left = 999 if current_user.is_premium else 3
    
    return {
        **current_user.__dict__,
        "daily_plays_left": daily_plays_left
    }

# 일일 재생 제한 확인
@router.get("/daily-limit")
async def check_daily_limit(current_user: User = Depends(get_current_user)):
    """오늘 남은 재생 횟수"""
    if current_user.is_premium:
        return {
            "is_premium": True,
            "plays_left": "unlimited",
            "message": "프리미엄 사용자는 무제한입니다"
        }
    
    # TODO: 실제로는 DB에서 오늘 재생 기록 확인
    plays_left = 3
    
    return {
        "is_premium": False,
        "plays_left": plays_left,
        "message": f"오늘 {plays_left}곡 남았습니다"
    }