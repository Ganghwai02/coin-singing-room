from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app import models
from app.auth import get_current_user # 인증 로직이 있다고 가정

router = APIRouter(prefix="/queue", tags=["Queue"])

@router.post("/reserve")
def reserve_song(song_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. 오늘 날짜 확인 및 일일 카운트 초기화 로직
    today = date.today()
    if current_user.last_active_date != today:
        current_user.daily_song_count = 0
        current_user.last_active_date = today:

    # 2. 무료 플랜 사용자 제한 체크
    if current_user.plan_type == "FREE":
        if current_user.daily_song_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="일일 무료 곡 수(3곡)를 모두 사용하셨습니다. 프리미엄 플랜을 이용해보세요!"
            )
    
    # 3. 예약하려는 곡이 프리미엄 전용인지 확인
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")

    if song.is_premium and current_user.plan_type == "FREE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 곡은 프리미엄 전용 곡입니다."
        )
    
    # 4. 예약(Queue) 생성
    new_queue = models.Queue(
        user_id=current_user.id,
        song_id=song_id,
        status="waiting"
    )

    # 5. 사용자 이름 횟수 증가 및 DB 저장
    current_user.daily_song_count += 1
    db.add(new_queue)
    db.commit()

    return {"message": "예약이 완료되었습니다.", "remaining_free_songs": 3 - current_user.daily_song_count if current_user.plan_type == "FREE" else "unlimited"}