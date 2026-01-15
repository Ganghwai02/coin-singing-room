from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import User, Song, Favorite, Queue, Recording 
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

class QueueResponse(BaseModel):
    id: int
    song_id: int
    title: str
    artist: str
    position: int

    class Config:
        from_attributes = True

class ScoreRequest(BaseModel):
    song_id: int
    score: float


class LyricsResponse(BaseModel):
    song_id: int
    title: str
    lyrics: str # 가사 전체 내용

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

# 4. 곡 재생 (일일 제한 로직)
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
        if current_user.daily_song_count >= 3:
            raise HTTPException(status_code=403, detail="오늘의 무료 곡(3곡)을 모두 사용하셨습니다.")
        
        current_user.daily_song_count += 1
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

# --- 6. 예약 시스템 & 우선 예약 ---
@router.post("/{song_id}/enqueue", status_code=201)
async def enqueue_song(
    song_id: int, 
    is_priority: bool = Query(False, description="우선 예약 여부"),
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")

    if is_priority:
        db.query(Queue).update({Queue.position: Queue.position + 1})
        next_position = 1
    else:
        last_item = db.query(Queue).order_by(Queue.position.desc()).first()
        next_position = (last_item.position + 1) if last_item else 1
    
    new_queue = Queue(song_id=song_id, position=next_position, room_id="default_room")
    db.add(new_queue)
    db.commit()
    
    return {"message": f"{'우선' if is_priority else '일반'} 예약 완료!", "position": next_position}

@router.get("/queue/list", response_model=List[QueueResponse])
async def get_queue_list(db: Session = Depends(get_db)):
    return db.query(Queue.id, Queue.song_id, Queue.position, Song.title, Song.artist).join(Song).order_by(Queue.position).all()

# --- 7. 보너스 로직 (100점 보너스) ---
@router.post("/finish", status_code=200)
async def finish_song(
    data: ScoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = f"당신의 점수는 {data.score}점입니다!"
    bonus_active = False

    if data.score >= 100:
        if not current_user.is_premium and current_user.daily_song_count > 0:
            current_user.daily_song_count -= 1
            db.commit()
            bonus_active = True
            message = "🎊 100점 보너스! 무료 곡 횟수가 1회 복구되었습니다! 🎊"

    new_record = Recording(user_id=current_user.id, song_id=data.song_id, score=data.score)
    db.add(new_record)
    db.commit()

    return {
        "score": data.score,
        "message": message,
        "bonus_awarded": bonus_active,
        "remaining_plays": 3 - current_user.daily_song_count if not current_user.is_premium else 999
    }

# --- 8. 통계 및 차트 관련 ---

# 인기 차트: 가장 많이 예약된 곡 TOP 10
@router.get("/charts/popular")
async def get_popular_charts(db: Session = Depends(get_db)):
    popular_songs = db.query(
        Song.id,
        Song.title,
        Song.artist,
        func.count(Queue.song_id).label('reserve_count')
    ).join(Queue, Song.id == Queue.song_id)\
     .group_by(Song.id)\
     .order_by(func.count(Queue.song_id).desc())\
     .limit(10).all()
    
    return [dict(row._mapping) for row in popular_songs]

# 명예의 전당: 내 최고 점수 TOP 5
@router.get("/charts/my-best")
async def get_my_best_scores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    best_scores = db.query(
        Song.title,
        Song.artist,
        Recording.score,
        Recording.created_at
    ).join(Song, Recording.song_id == Song.id)\
     .filter(Recording.user_id == current_user.id)\
     .order_by(Recording.score.desc())\
     .limit(5).all()
    
    return [dict(row._mapping) for row in best_scores]

# --- 9. 자동 로딩 (Dequeue & Play) ---

@router.post("/queue/play-next")
async def play_next_in_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. 1번 위치의 곡 찾기
    next_item = db.query(Queue).order_by(Queue.position.asc()).first()
    
    if not next_item:
        raise HTTPException(status_code=404, detail="대기열이 비어있습니다.")
    
    # 2. 곡 정보 확인
    song = db.query(Song).filter(Song.id == next_item.song_id).first()
    
    # 3. 재생 횟수 체크 및 증가
    if not current_user.is_premium:
        if current_user.daily_song_count >= 3:
            raise HTTPException(status_code=403, detail="무료 횟수를 모두 사용하셨습니다.")
        current_user.daily_song_count += 1

    # 4. 큐에서 제거 및 순서 재정렬
    db.delete(next_item)
    db.flush()
    db.query(Queue).filter(Queue.position > 1).update({Queue.position: Queue.position - 1})
    
    db.commit()
    
    return {
        "message": f"다음 대기곡 '{song.title}' 재생을 시작합니다!",
        "remaining_plays": 3 - current_user.daily_song_count if not current_user.is_premium else 999,
        "song_id": song.id
    }

# --- 10. 멀티룸 시스템 (Room-based Queue) ---

# 내 현재 방의 대기열만 조회 (기존 조회 수정 버전)
@router.get("/rooms/{room_id}/queue", response_model=List[QueueResponse])
async def get_room_queue(room_id: str, db: Session = Depends(get_db)):
    return db.query(Queue.id, Queue.song_id, Queue.position, Song.title, Song.artist)\
             .join(Song).filter(Queue.room_id == room_id)\
             .order_by(Queue.position).all()

# --- 11. 가사 서비스 (Lyrics) ---

@router.get("/{song_id}/lyrics", response_model=LyricsResponse)
async def get_song_lyrics(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(song_id == song_id).first()
    if not Song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")
    
    # 실제 환경에서는 lyrics_path의 파일을 읽어오지만, 여기선 예시 텍스트를 반환합니다.
    sample_lyrics = f"[{song.title} - 가사]\n이 노래는 즐거운 노래입니다...\n라라라라~"

    return {
        "song_id": song_id,
        "title": song.title,
        "lyrics": song.audio_path if song.audio_path else sample_lyrics # 경로가 있으면 경로 출력
    }

# --- 12. 친구 시스템 (Friendship & Social) ---

# 친구 점수 랭킹 (전체 유저 대상 혹은 친구 필터)
@router.get("/social/leaderboard")
async def get_social_leaderboard(db: Session = Depends(get_db)):
    # 유저별 최고 점수를 집계하여 랭킹 생성
    leaderboard = db.query(
        User.username,
        func.max(Recording.score).label('top_score')
    ).join(Recording, User.id == Recording.user_id())\
    .order_by(func.max(Recording.score).desc())\
    .limit(10).all()

    return [dict(row.mapping) for row in leaderboard]