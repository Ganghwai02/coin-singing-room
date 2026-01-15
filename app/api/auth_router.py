from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter()

@router.post("/register")
def register(username: str, password: str, plan: str = "free", db: Session = Depends(get_db)):
    # 중복 체크
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    
    # 플랜 설정
    is_monthly = True if plan == "monthly" else False
    is_premium = True if plan == "premium" else False
    
    new_user = User(
        username=username, 
        password=hash_password(password),
        is_monthly=is_monthly,
        is_premium=is_premium
    )
    db.add(new_user)
    db.commit()
    return {"message": f"{plan} 플랜으로 가입 완료!"}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 여기서 form_data.username과 form_data.password를 사용합니다.
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")
    
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}