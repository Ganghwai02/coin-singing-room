from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import date
import os
from pathlib import Path

from app.database import get_db
from app.models import User, Song, Favorite, Queue, Recording 
from app.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# 프로젝트 루트 경로 자동 계산 (상대 경로 오류 완벽 방지)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MIDI_STORAGE_PATH = BASE_DIR / "app" / "storage" / "midi_files"

# ==========================================================
# [1] 데이터 규격 정의
# ==========================================================
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
# [🛠️ Helper] MIDI 파싱 (경로 및 예외처리 강화)
# ==========================================================
def parse_midi_file(file_name: str) -> List[Dict[str, Any]]:
    file_path = MIDI_STORAGE_PATH / file_name
    print(f"--- MIDI 로딩 시도: {file_path}")

    if not file_path.exists():
        print(f"--- [파일 없음 에러]: {file_path}")
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
    except Exception as e:
        print(f"--- [파싱 실패]: {e}")
        return []

# ==========================================================
# [2] 다음 곡 재생 로직
# ==========================================================
@router.post("/queue/play-next", response_model=PlayNextResponse)
async def play_next(room_id: str = "Room_A", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    next_item = db.query(Queue).filter(Queue.room_id == room_id).order_by(Queue.position.asc()).first()
    if not next_item: 
        raise HTTPException(status_code=404, detail="대기열이 비어있습니다.")
    
    song = db.query(Song).filter(Song.id == next_item.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡 정보를 찾을 수 없습니다.")
    
    # 🎹 파일명 공백 주의: 실제 파일 시스템과 일치해야 함
    midi_filename = "Clark Audio -  K Pop Bounce Fmaj.mid" 
    midi_data = parse_midi_file(midi_filename)

    # 잔여 횟수 계산
    remaining = 999 if (current_user.is_monthly or current_user.is_premium) else (3 - current_user.daily_song_count)

    db.delete(next_item)
    db.commit()

    return {
        "message": f"'{song.title}' 재생 시작",
        "song_id": song.id,
        "title": song.title,
        "midi_data": midi_data,
        "remaining_plays": max(0, remaining),
        "is_hd": True,
        "has_vocal_coaching": current_user.is_premium,
        "can_record": True
    }

@router.get("/charts/popular")
async def get_popular_charts(db: Session = Depends(get_db)):
    popular = db.query(Song).limit(10).all()
    return [{"id": s.id, "title": s.title, "artist": s.artist} for s in popular]