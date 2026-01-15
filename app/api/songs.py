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
# 파이썬은 위에서 아래로 읽으므로, 아래 함수들이 참조하기 전에 여기서 먼저 정의해야 합니다.
# ==========================================================

class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    is_premium: bool
    video_url: Optional[str] = None
    class Config:
        from_attributes = True

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
    lyrics: str
    video_url: Optional[str] = None
    sync_data: Optional[List[dict]] = []

class PlayNextResponse(BaseModel):
    song_id: int
    title: str
    video_url: Optional[str] = None
    remaining_plays: int

# ==========================================================
# [2] 예약 기능 (Enqueue / List)
# ==========================================================

@router.post("/{song_id}/enqueue")
async def enqueue_song(song_id: int, room_id: str = "Room_A", db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")

    last_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.desc()).first()
    next_pos = (last_item.position + 1) if last_item else 1
    
    new_queue = Queue(song_id=song_id, position=next_pos, room_id=room_id)
    db.add(new_queue)
    db.commit()
    return {"message": f"'{song.title}' 예약 완료!"}

@router.get("/queue/list", response_model=List[QueueResponse])
async def get_queue_list(room_id: str = "Room_A", db: Session = Depends(get_db)):
    # 여기서 QueueResponse를 사용하므로 위에 정의되어 있어야 합니다.
    return db.query(Queue.id, Queue.song_id, Queue.position, Song.title, Song.artist)\
             .join(Song).filter(Queue.room_id == room_id)\
             .order_by(Queue.position).all()

# ==========================================================
# [3] 다음 곡 재생 (Dequeue + 횟수 차감)
# ==========================================================

@router.post("/queue/play-next", response_model=PlayNextResponse)
async def play_next(room_id: str = "Room_A", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    next_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.asc()).first()
    if not next_item:
        raise HTTPException(status_code=404, detail="예약된 곡이 없습니다.")
    
    if not current_user.is_premium:
        today = date.today()
        if current_user.last_active_date != today:
            current_user.daily_song_count = 0
            current_user.last_active_date = today
        if current_user.daily_song_count >= 3:
            raise HTTPException(status_code=403, detail="일일 횟수 초과")
        current_user.daily_song_count += 1
    
    song = db.query(Song).filter(Song.id == next_item.song_id).first()
    db.delete(next_item)
    db.query(Queue).filter(Queue.room_id == room_id, Queue.position > next_item.position).update({Queue.position: Queue.position - 1})
    db.commit()
    
    remaining = 999 if current_user.is_premium else (3 - current_user.daily_song_count)
    return {"song_id": song.id, "title": song.title, "video_url": song.video_url, "remaining_plays": remaining}

# ==========================================================
# [4] 가사 데이터 조회
# ==========================================================

@router.get("/{song_id}/lyrics", response_model=LyricsResponse)
async def get_lyrics(song_id: int, db: Session = Depends(get_db)):
    # 여기서 LyricsResponse를 사용하므로 위에 정의되어 있어야 합니다.
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡 정보 없음")
    
    sync = [
        {"time": 2, "text": "🎵 (전주 중...)"},
        {"time": 5, "text": "첫 소절 시작!"},
        {"time": 10, "text": "즐거운 노래방 플랫폼입니다!"}
    ]
    return {"song_id": song.id, "title": song.title, "lyrics": "가사", "video_url": song.video_url, "sync_data": sync}

# ==========================================================
# [5] 점수 및 보너스
# ==========================================================

@router.post("/finish")
async def finish_song(data: ScoreRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = f"기록 완료 ({data.score}점)"
    if data.score >= 100 and not current_user.is_premium and current_user.daily_song_count > 0:
        current_user.daily_song_count -= 1
        msg = "🎊 100점 보너스! 횟수 복구 완료! 🎊"
    
    db.add(Recording(user_id=current_user.id, song_id=data.song_id, score=data.score))
    db.commit()
    remaining = 999 if current_user.is_premium else (3 - current_user.daily_song_count)
    return {"message": msg, "remaining_plays": remaining}

    
# --- 6. 예약 시스템 & 우선 예약 (방 ID 지원 수정) ---
@router.post("/{song_id}/enqueue", status_code=201)
async def enqueue_song(
    song_id: int, 
    room_id: str = Query("Room_A", description="방 번호"), # 파라미터 추가
    is_priority: bool = Query(False, description="우선 예약 여부"),
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")

    if is_priority:
        # 해당 방의 곡들만 순서 밀기
        db.query(Queue).filter(Queue.room_id == room_id).update({Queue.position: Queue.position + 1})
        next_position = 1
    else:
        # 해당 방의 마지막 순번 찾기
        last_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.desc()).first()
        next_position = (last_item.position + 1) if last_item else 1
    
    new_queue = Queue(song_id=song_id, position=next_position, room_id=room_id)
    db.add(new_queue)
    db.commit()
    
    return {"message": f"[{room_id}] {'우선' if is_priority else '일반'} 예약 완료!", "position": next_position}

@router.get("/queue/list", response_model=List[QueueResponse])
async def get_queue_list(
    room_id: str = Query("Room_A", description="방 번호"), # 파라미터 추가
    db: Session = Depends(get_db)
):
    return db.query(Queue.id, Queue.song_id, Queue.position, Song.title, Song.artist)\
             .join(Song).filter(Queue.room_id == room_id)\
             .order_by(Queue.position).all()

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

# --- 11. 가사 서비스 (Lyrics 싱크 데이터 추가) ---
@router.get("/{song_id}/lyrics", response_model=LyricsResponse)
async def get_song_lyrics(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")
    
    # 실시간 가사 싱크를 위한 샘플 데이터 (초 단위)
    sample_sync = [
        {"time": 2, "text": "🎵 (전주 흐르는 중...)"},
        {"time": 5, "text": "첫 소절이 시작됩니다!"},
        {"time": 10, "text": "두 번째 가사도 박자에 맞춰서~"},
        {"time": 15, "text": "마지막 가사가 지나갑니다. 🎤"}
    ]

    return {
        "song_id": song_id,
        "title": song.title,
        "lyrics": f"[{song.title}] 전체 가사입니다...",
        "sync_data": sample_sync
    }

# --- 12. 친구 시스템 (리더보드 로직 수정) ---
@router.get("/social/leaderboard")
async def get_social_leaderboard(db: Session = Depends(get_db)):
    # 유저별 최고 점수를 집계하여 랭킹 생성 (dict mapping 수정)
    leaderboard = db.query(
        User.username,
        func.max(Recording.score).label('top_score')
    ).join(Recording, User.id == Recording.user_id)\
     .group_by(User.id)\
     .order_by(func.max(Recording.score).desc())\
     .limit(10).all()

    return [dict(row._mapping) for row in leaderboard]