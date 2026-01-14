from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
from app.database import get_db
from app import models
from app.auth import get_current_user
import os

router = APIRouter(prefix="/streaming", tags=["Streaming"])

# 음원 저장 경로 (상대 경로)
AUDIO_DIR = "app/storage/audio"

@router.get("/play/{song_id}")
def stream_song(song_id: int, db: Session = Depends(get_db), current_user: models.user = Depends(get_current_user)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()

    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")

    # 1. 프리미엄 곡 접근 제어 (한번 더 체크)
    if song.is_premium and current_user.plan_type == "FREE":
        raise HTTPException(status_code=403, detail="프리미엄 요금제 이용자만 재생 가능합니다.")


    # 2. 무료 사용자를 위한 응답 데이터 (광고 여부 포함)
    response_data = {
        "song_title": song.title,
        "artist": song.artist,
        "stream_url": f"/storage/audio/{song.audio_path}",
        "show_ads": True if current_user.plan_type == "FREE" else False,
        "can_record": True if current_user.plan_type != "FREE" else False, # 녹음 가능 여부
        "video_quality": "HD" if current_user.plan_type == "PREMIUM" else "SD"
    }

    return response_data

@router.get("/download-record/{recording_id}")
def get_recording(recording_id: int, current_user: models.User = Depends(get_current_user)):
    # 3. 녹음본 저장/다운로드 기능 (프리미엄 전용)
    if current_user.plan_type == "FREE":
        raise HTTPException(status_code=403, detail="녹음 기능은 프리미엄 유저만 사용 가능합니다.")


    # 실제 파일 반환 로직
    return {"message": "녹음 파일을 준비 중입니다."}
