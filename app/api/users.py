from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, date
from app.database import get_db
from app.models import User
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.config import settings
from pydantic import BaseModel, EmailStr

router = APIRouter()

# --- Pydantic 스키마 ---
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

# --- API 엔드포인트 ---

# 1. 회원가입
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다"
        )
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        is_premium=False,
        daily_song_count=0,  # 초기화
        last_active_date=date.today()  # 가입일 기준
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "id": new_user.id,
        "email": new_user.email,
        "username": new_user.username,
        "is_premium": new_user.is_premium,
        "daily_plays_left": 3
    }

# 2. 로그인 (핵심 수정 부분!)
@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """로그인 및 토큰 발급"""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ⚠️ 중요: "sub" 값은 반드시 문자열 str(user.id)로 전달해야 auth.py와 호환됩니다.
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, 
        expires_delta=access_token_expires
    )
    
    # 오늘 남은 횟수 계산
    daily_plays_left = 999 if user.is_premium else max(0, 3 - user.daily_song_count)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_premium": user.is_premium,
            "daily_plays_left": daily_plays_left
        }
    }

# 3. 내 정보 조회 (인증 테스트용)
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    daily_plays_left = 999 if current_user.is_premium else max(0, 3 - current_user.daily_song_count)
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "is_premium": current_user.is_premium,
        "daily_plays_left": daily_plays_left
    }

# 4. 일일 제한 확인
@router.get("/daily-limit")
async def check_daily_limit(current_user: User = Depends(get_current_user)):
    """오늘 남은 재생 횟수 상세 조회"""
    if current_user.is_premium:
        return {
            "is_premium": True,
            "plays_left": "unlimited",
            "message": "프리미엄 사용자는 무제한입니다"
        }
    
    plays_left = max(0, 3 - current_user.daily_song_count)
    
    return {
        "is_premium": False,
        "plays_left": plays_left,
        "message": f"오늘 {plays_left}곡 남았습니다"
    }