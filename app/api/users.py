from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import timedelta, datetime, date
from pathlib import Path

from app.database import get_db
from app.models import User, Song, Favorite, Queue, Recording 
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.config import settings
from pydantic import BaseModel, EmailStr

router = APIRouter()

# 프로젝트 루트 경로 자동 계산 (MIDI 파일 로드용)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MIDI_STORAGE_PATH = BASE_DIR / "app" / "storage" / "midi_files"

# --- Pydantic 스키마 (데이터 규격) ---
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserUpdate(BaseModel):
    username: str = None
    password: str = None

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

class PlayNextResponse(BaseModel):
    message: str
    song_id: int
    title: str
    midi_data: List[Dict[str, Any]]
    remaining_plays: int
    is_hd: bool
    has_vocal_coaching: bool
    can_record: bool

# ==========================================================
# [🛠️ Helper] MIDI 파싱 (경로 및 예외처리)
# ==========================================================
def parse_midi_file(file_name: str) -> List[Dict[str, Any]]:
    file_path = MIDI_STORAGE_PATH / file_name
    if not file_path.exists():
        return []

    try:
        mid = mido.MidiFile(str(file_path))
        midi_events = []
        for track in mid.tracks:
            current_tick = 0
            for msg in track:
                current_tick += msg.time
                if msg.type == 'note_on' and msg.velocity > 0:
                    midi_events.append({
                        "time": current_tick / mid.ticks_per_beat, 
                        "note": msg.note,
                        "velocity": msg.velocity
                    })
        return midi_events
    except Exception:
        return []

# ==========================================================
# [1] 유저 관리 엔드포인트
# ==========================================================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password=hashed_password,
        is_premium=False,
        daily_song_count=0,
        last_active_date=date.today()
    )   
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id": new_user.id, "email": new_user.email, "username": new_user.username,
        "is_premium": new_user.is_premium, "daily_plays_left": 3
    }

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """로그인 및 토큰 발급"""
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    daily_plays_left = 999 if user.is_premium else max(0, 3 - user.daily_song_count)
    
    return {
        "access_token": access_token, "token_type": "bearer",
        "user": {
            "id": user.id, "email": user.email, "username": user.username,
            "is_premium": user.is_premium, "daily_plays_left": daily_plays_left
        }
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    daily_plays_left = 999 if current_user.is_premium else max(0, 3 - current_user.daily_song_count)
    return {
        "id": current_user.id, "email": current_user.email, "username": current_user.username,
        "is_premium": current_user.is_premium, "daily_plays_left": daily_plays_left
    }

@router.patch("/me", response_model=UserResponse)
async def update_user_info(user_data: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """내 정보 수정"""
    if user_data.username:
        current_user.username = user_data.username
    if user_data.password:
        current_user.password = get_password_hash(user_data.password)
    db.commit()
    db.refresh(current_user)
    daily_plays_left = 999 if current_user.is_premium else max(0, 3 - current_user.daily_song_count)
    return {
        "id": current_user.id, "email": current_user.email, "username": current_user.username,
        "is_premium": current_user.is_premium, "daily_plays_left": daily_plays_left
    }

# ==========================================================
# [2] 노래 및 차트 서비스 엔드포인트
# ==========================================================

@router.get("/charts/popular")
async def get_popular_charts(db: Session = Depends(get_db)):
    """DB 대신 직접 정의한 차트 리스트 반환"""
    charts = [
        { "id": 1, "title": "[TJ노래방] 에피소드 - 이무진", "artist": "이무진" },
        { "id": 2, "title": "[TJ노래방] Love wins all - IU", "artist": "아이유" },
        { "id": 3, "title": "[TJ노래방] 밤양갱 - 비비(BIBI)", "artist": "비비" },
        { "id": 4, "title": "[TJ노래방] Hype boy - NewJeans", "artist": "NewJeans" },
        { "id": 5, "title": "[TJ노래방] Seven(Clean Ver.) - 정국(Feat.Latto)", "artist": "정국" },
        { "id": 6, "title": "[TJ노래방   MR Live] 첫만남은계획대로되지않아 - TWS(투어스)", "artist": "TWS" },
        { "id": 7, "title": "[TJ노래방] Super Lady - (여자)아이들", "artist": "(여자)아이들" },
        { "id": 8, "title": "[TJ노래방] To. X - 태연(TAEYEON)", "artist": "태연" },
        { "id": 9, "title": "[TJ노래방] Love 119 - RIIZE", "artist": "RIIZE" },
        { "id": 10, "title": "[TJ노래방] Perfect Night - LE SSERAFIM(르세라핌)", "artist": "LE SSERAFIM" },
        { "id": 11, "title": "[TJ노래방] Drama - 에스파(aespa)", "artist": "aespa" },
        { "id": 12, "title": "[TJ노래방] 헤어지자말해요 - 박재정", "artist": "박재정" },
        { "id": 13, "title": "[TJ노래방] I AM - IVE(아이브)", "artist": "IVE" },
        { "id": 14, "title": "[TJ노래방] Ditto - NewJeans", "artist": "NewJeans" },
        { "id": 15, "title": "[TJ노래방] 응급실(쾌걸춘향OST) - izi", "artist": "izi" },
        { "id": 16, "title": "[TJ노래방] 가시 - 버즈", "artist": "버즈" },
        { "id": 17, "title": "[TJ노래방] 체념 - 빅마마", "artist": "빅마마" },
        { "id": 18, "title": "[TJ노래방] 소주한잔 - 임창정", "artist": "임창정" },
        { "id": 19, "title": "[TJ노래방] Welcome to the Show - 데이식스(DAY6)", "artist": "DAY6" },
        { "id": 20, "title": "[TJ노래방] 한페이지가될수있게 - 데이식스(DAY6)", "artist": "DAY6" }
    ]
    return charts

@router.post("/queue/play-next", response_model=PlayNextResponse)
async def play_next(room_id: str = "Room_A", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """대기열의 다음 곡 재생 및 횟수 차감"""
    next_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.asc()).first()
    if not next_item: 
        raise HTTPException(status_code=404, detail="대기열이 비어있습니다.")
    
    song = db.query(Song).filter(Song.id == next_item.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡 정보를 찾을 수 없습니다.")
    
    # MIDI 데이터 로드
    midi_filename = "Clark Audio - K Pop Bounce Fmaj.mid" 
    midi_data = parse_midi_file(midi_filename)

    # 곡 재생 시 사용자의 일일 재생 횟수 1 증가
    current_user.daily_song_count += 1
    db.delete(next_item)
    db.commit()

    remaining = 999 if current_user.is_premium else max(0, 3 - current_user.daily_song_count)

    return {
        "message": f"'{song.title}' 재생 시작",
        "song_id": song.id,
        "title": song.title,
        "midi_data": midi_data,
        "remaining_plays": remaining,
        "is_hd": True,
        "has_vocal_coaching": current_user.is_premium,
        "can_record": True
    }