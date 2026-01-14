from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User

# 비밀번호 해싱 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 스키마 설정 (앞에 /를 붙여 절대 경로로 설정)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWT 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # 토큰 만료 시간 추가
    to_encode.update({"exp": expire})
    # 설정 파일의 SECRET_KEY와 ALGORITHM으로 인코딩
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """현재 로그인한 사용자 가져오기 (401 에러 해결 버전)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보를 확인할 수 없습니다. 다시 로그인해 주세요.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. 토큰 복호화
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # 2. sub 필드에서 유저 식별자 추출 (문자열로 반환됨)
        token_data: str = payload.get("sub")
        if token_data is None:
            raise credentials_exception
        
        # 3. 데이터 타입 변환 (문자열 ID를 정수로 변환)
        try:
            user_id = int(token_data)
        except ValueError:
            # 만약 sub에 이메일이 들어있을 경우를 대비한 로직 (ID가 숫자가 아닐 때)
            user = db.query(User).filter(User.email == token_data).first()
            if user:
                return user
            raise credentials_exception

    except JWTError:
        raise credentials_exception
    
    # 4. DB에서 최종 유저 조회
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_premium_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """프리미엄 사용자인지 확인"""
    if not current_user.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프리미엄 구독이 필요합니다"
        )
    return current_user