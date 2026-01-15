from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from datetime import date, datetime
from app.database import get_db
from app.models import User, Song, Favorite, Queue, Recording 
from app.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# ==========================================================
# [1] 데이터 규격 정의 (Pydantic 스키마)
# ==========================================================
class QueueResponse(BaseModel):
    id: int; song_id: int; title: str; artist: str; position: int; room_id: str
    class Config: from_attributes = True

class ScoreRequest(BaseModel):
    song_id: int; score: float

class LyricsResponse(BaseModel):
    song_id: int; title: str; lyrics: str; video_url: Optional[str] = None; sync_data: Optional[List[dict]] = []

class PlayNextResponse(BaseModel):
    message: str; song_id: int; title: str; video_url: Optional[str]
    remaining_plays: int; is_hd: bool; has_vocal_coaching: bool; can_record: bool

# ==========================================================
# [2] 예약 및 대기열 시스템 (멀티룸/우선예약 지원)
# ==========================================================

@router.post("/{song_id}/enqueue")
async def enqueue_song(
    song_id: int, 
    room_id: str = "Room_A", 
    is_priority: bool = False, 
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song: raise HTTPException(status_code=404, detail="곡 없음")

    if is_priority:
        db.query(Queue).filter(Queue.room_id == room_id).update({Queue.position: Queue.position + 1})
        next_pos = 1
    else:
        last = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.desc()).first()
        next_pos = (last.position + 1) if last else 1
    
    new_q = Queue(song_id=song_id, position=next_pos, room_id=room_id)
    db.add(new_q)
    db.commit()
    return {"message": f"[{room_id}] {'우선' if is_priority else '일반'} 예약 완료!", "title": song.title}

@router.get("/queue/list", response_model=List[QueueResponse])
async def get_queue_list(room_id: str = "Room_A", db: Session = Depends(get_db)):
    return db.query(Queue.id, Queue.song_id, Queue.position, Queue.room_id, Song.title, Song.artist)\
             .join(Song).filter(Queue.room_id == room_id)\
             .order_by(Queue.position).all()

# ==========================================================
# [3] 다음 곡 재생 (플랜별 권한 체크 핵심 로직)
# ==========================================================

@router.post("/queue/play-next", response_model=PlayNextResponse)
async def play_next(room_id: str = "Room_A", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. 곡 찾기
    next_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.asc()).first()
    if not next_item: raise HTTPException(status_code=404, detail="대기열 비었음")
    
    song = db.query(Song).filter(Song.id == next_item.song_id).first()

    # 2. 플랜별 이용 권한 체크
    # [프리미엄 곡 체크]
    if song.is_premium and not (current_user.is_monthly or current_user.is_premium):
        raise HTTPException(status_code=403, detail="월간/프리미엄 플랜 전용 곡입니다.")

    # [무료 플랜 일일 3곡 제한]
    remaining = 999
    if not (current_user.is_monthly or current_user.is_premium):
        today = date.today()
        if current_user.last_active_date != today:
            current_user.daily_song_count = 0
            current_user.last_active_date = today
        if current_user.daily_song_count >= 3:
            raise HTTPException(status_code=403, detail="일일 무료 3곡을 모두 사용하셨습니다.")
        current_user.daily_song_count += 1
        remaining = 3 - current_user.daily_song_count

    # 3. 큐에서 제거 및 정렬
    db.delete(next_item)
    db.query(Queue).filter(Queue.room_id == room_id, Queue.position > 1).update({Queue.position: Queue.position - 1})
    db.commit()

    return {
        "message": f"'{song.title}' 재생 시작",
        "song_id": song.id,
        "title": song.title,
        "video_url": song.video_url,
        "remaining_plays": remaining,
        "is_hd": current_user.is_monthly or current_user.is_premium, # 유료는 HD
        "has_vocal_coaching": current_user.is_premium,               # 프리미엄 전용
        "can_record": current_user.is_monthly or current_user.is_premium # 유료는 녹음 가능
    }

# ==========================================================
# [4] 점수 및 보너스 & 녹음 저장
# ==========================================================

@router.post("/finish")
async def finish_song(data: ScoreRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = f"기록 완료 ({data.score}점)"
    
    # 100점 보너스 (무료 사용자만 해당)
    if data.score >= 100 and not (current_user.is_monthly or current_user.is_premium) and current_user.daily_song_count > 0:
        current_user.daily_song_count -= 1
        msg = "🎊 100점 보너스! 무료 횟수 복구 완료! 🎊"
    
    db.add(Recording(user_id=current_user.id, song_id=data.song_id, score=data.score))
    db.commit()
    
    remaining = 999 if (current_user.is_monthly or current_user.is_premium) else (3 - current_user.daily_song_count)
    return {"message": msg, "remaining_plays": remaining}

# ==========================================================
# [5] 차트 및 소셜 기능
# ==========================================================

@router.get("/charts/popular")
async def get_popular_charts(db: Session = Depends(get_db)):
    popular = db.query(Song.id, Song.title, Song.artist, func.count(Recording.id).label('play_count'))\
                .join(Recording).group_by(Song.id).order_by(func.count(Recording.id).desc()).limit(10).all()
    return [dict(row._mapping) for row in popular]

@router.get("/social/leaderboard")
async def get_leaderboard(db: Session = Depends(get_db)):
    board = db.query(User.username, func.max(Recording.score).label('top_score'))\
              .join(Recording).group_by(User.id).order_by(func.max(Recording.score).desc()).limit(10).all()
    return [dict(row._mapping) for row in board]

# ==========================================================
# [6] 가사 서비스
# ==========================================================

@router.get("/{song_id}/lyrics", response_model=LyricsResponse)
async def get_lyrics(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song: raise HTTPException(status_code=404)
    
    sync = [
        {"time": 2, "text": "🎵 (전주 중...)"},
        {"time": 5, "text": "첫 소절 시작!"},
        {"time": 10, "text": "즐거운 SingStar 플랫폼입니다!"}
    ]
    return {"song_id": song.id, "title": song.title, "lyrics": "가사", "video_url": song.video_url, "sync_data": sync}