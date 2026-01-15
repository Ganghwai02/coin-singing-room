from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date
from app.database import get_db
# Queue 모델을 추가로 불러옵니다.
from app.models import User, Song, Favorite, Queue 
from app.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# --- Pydantic 스키마 ---

class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    genre: Optional[str]
    difficulty: int
    duration: Optional[int] = 0
    is_premium: bool
    video_url: Optional[str]
    is_favorited: bool = False
    
    class Config:
        from_attributes = True

class SongDetail(SongResponse):
    audio_path: Optional[str]
    lyrics_path: Optional[str]
    created_at: str

class PlayResponse(BaseModel):
    success: bool
    message: str
    remaining_plays: int 
    song_id: int
    title: str

class SongCreate(BaseModel):
    title: str
    artist: str
    genre: str
    is_premium: bool = False

# [추가] 예약 목록 응답을 위한 스키마
class QueueResponse(BaseModel):
    id: int
    song_id: int
    title: str
    artist: str
    position: int

    class Config:
        from_attributes = True

# --- API 엔드포인트 ---

# 1. 곡 목록 조회
@router.get("/", response_model=List[SongResponse])
async def get_songs(
    search: Optional[str] = Query(None, description="곡명, 가수 검색"),
    genre: Optional[str] = Query(None, description="장르 필터"),
    is_premium: Optional[bool] = Query(None, description="프리미엄 곡만"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Song)
    if search:
        query = query.filter(or_(Song.title.ilike(f"%{search}%"), Song.artist.ilike(f"%{search}%")))
    if genre:
        query = query.filter(Song.genre == genre)
    if is_premium is not None:
        query = query.filter(Song.is_premium == is_premium)
    
    songs = query.offset(skip).limit(limit).all()
    favorite_song_ids = {fav.song_id for fav in db.query(Favorite).filter(Favorite.user_id == current_user.id).all()}
    
    return [{**song.__dict__, "is_favorited": song.id in favorite_song_ids} for song in songs]

# 2. 곡 상세 정보
@router.get("/{song_id}", response_model=SongDetail)
async def get_song(song_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")
    
    if song.is_premium and not current_user.is_premium:
        raise HTTPException(status_code=403, detail="프리미엄 구독이 필요한 곡입니다")
    
    is_favorited = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.song_id == song_id).first() is not None
    
    return {**song.__dict__, "created_at": song.created_at.isoformat(), "is_favorited": is_favorited}

# 3. 노래 등록
@router.post("/", status_code=201)
async def create_song(song_data: SongCreate, db: Session = Depends(get_db)):
    new_song = Song(**song_data.dict())
    db.add(new_song)
    db.commit()
    db.refresh(new_song)
    return new_song

# 4. 곡 재생 (일일 제한 로직 포함)
@router.post("/{song_id}/play", response_model=PlayResponse)
async def play_song(
    song_id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")

    today = date.today()
    if current_user.last_active_date != today:
        current_user.daily_song_count = 0
        current_user.last_active_date = today
        db.commit()

    if song.is_premium and not current_user.is_premium:
        raise HTTPException(status_code=403, detail="프리미엄 구독이 필요한 곡입니다")

    if current_user.is_premium:
        remaining = 999 
    else:
        print(f"DEBUG: {current_user.username}의 현재 카운트 = {current_user.daily_song_count}")
        if current_user.daily_song_count >= 3:
            raise HTTPException(status_code=403, detail="오늘의 무료 곡(3곡)을 모두 사용하셨습니다.")
        
        current_user.daily_song_count += 1
        db.add(current_user)
        db.flush()
        db.commit()
        db.refresh(current_user)
        remaining = 3 - current_user.daily_song_count

    return {
        "success": True,
        "message": f"'{song.title}' 재생을 시작합니다!",
        "remaining_plays": remaining,
        "song_id": song.id,
        "title": song.title
    }

# --- 5. 즐겨찾기 관련 ---
@router.post("/{song_id}/favorite")
async def add_favorite(song_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.song_id == song_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 즐겨찾기된 곡입니다")
    
    db.add(Favorite(user_id=current_user.id, song_id=song_id))
    db.commit()
    return {"message": "즐겨찾기에 추가되었습니다"}

@router.delete("/{song_id}/favorite")
async def remove_favorite(song_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.song_id == song_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="즐겨찾기를 찾을 수 없습니다")
    db.delete(fav)
    db.commit()
    return {"message": "즐겨찾기에서 삭제되었습니다"}

@router.get("/favorites/my-list", response_model=List[SongResponse])
async def get_my_favorites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    songs = db.query(Song).join(Favorite).filter(Favorite.user_id == current_user.id).all()
    return [{**song.__dict__, "is_favorited": True} for song in songs]

# --- 6. [추가] 예약 시스템 (Queue) 관련 ---

# 곡 예약하기
@router.post("/{song_id}/enqueue", status_code=201)
async def enqueue_song(
    song_id: int, 
    current_user: User = Depends(get_current_user), # 유저 확인용
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")

    # 현재 대기 중인 마지막 순번 찾기
    last_item = db.query(Queue).order_by(Queue.position.desc()).first()
    next_position = (last_item.position + 1) if last_item else 1
    
    new_queue = Queue(
        song_id=song_id,
        position=next_position,
        room_id="default_room" # 기본 방 설정
    )
    
    db.add(new_queue)
    db.commit()
    
    return {"success": True, "message": f"'{song.title}' 곡이 예약되었습니다!", "position": next_position}

# 예약 목록 조회하기 (Join 사용하여 제목까지 가져옴)
@router.get("/queue/list", response_model=List[QueueResponse])
async def get_queue_list(db: Session = Depends(get_db)):
    results = db.query(
        Queue.id, 
        Queue.song_id, 
        Queue.position, 
        Song.title, 
        Song.artist
    ).join(Song, Queue.song_id == Song.id).order_by(Queue.position).all()
    
    return results

# 예약 취소하기
@router.delete("/queue/{queue_id}")
async def dequeue_song(queue_id: int, db: Session = Depends(get_db)):
    target = db.query(Queue).filter(Queue.id == queue_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="예약 내역을 찾을 수 없습니다")
    
    db.delete(target)
    db.commit()
    return {"message": "예약이 취소되었습니다"}