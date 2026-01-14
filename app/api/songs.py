from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import User, Song, Favorite
from app.auth import get_current_user, get_current_premium_user
from pydantic import BaseModel

router = APIRouter()

# Pydantic 스키마
class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    genre: Optional[str]
    difficulty: int
    duration: int
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
    plays_left: int
    remaining_plays: int  # 이 줄이 반드시 있어야 합니다!
    song_id: Optional[int] = None

class SongCreate(BaseModel):
    title: str
    artist: str
    genre: str
    is_premium: bool = False

# 곡 목록 조회 (검색, 필터링)
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
    """곡 목록 조회 (검색, 필터링)"""
    
    # 기본 쿼리
    query = db.query(Song)
    
    # 검색
    if search:
        query = query.filter(
            or_(
                Song.title.ilike(f"%{search}%"),
                Song.artist.ilike(f"%{search}%")
            )
        )
    
    # 장르 필터
    if genre:
        query = query.filter(Song.genre == genre)
    
    # 프리미엄 필터
    if is_premium is not None:
        query = query.filter(Song.is_premium == is_premium)
    
    # 페이지네이션
    songs = query.offset(skip).limit(limit).all()
    
    # 즐겨찾기 여부 확인
    favorite_song_ids = {fav.song_id for fav in db.query(Favorite).filter(Favorite.user_id == current_user.id).all()}
    
    result = []
    for song in songs:
        song_dict = {
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "genre": song.genre,
            "difficulty": song.difficulty,
            "duration": song.duration,
            "is_premium": song.is_premium,
            "video_url": song.video_url,
            "is_favorited": song.id in favorite_song_ids
        }
        result.append(song_dict)
    
    return result

# 곡 상세 정보
@router.get("/{song_id}", response_model=SongDetail)
async def get_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """곡 상세 정보"""
    
    song = db.query(Song).filter(Song.id == song_id).first()
    
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="곡을 찾을 수 없습니다"
        )
    
    # 프리미엄 곡인데 무료 사용자면 제한
    if song.is_premium and not current_user.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프리미엄 구독이 필요한 곡입니다"
        )
    
    # 즐겨찾기 여부
    is_favorited = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.song_id == song_id
    ).first() is not None
    
    return {
        **song.__dict__,
        "created_at": song.created_at.isoformat(),
        "is_favorited": is_favorited
    }


# 노래 등록
@router.post("/", status_code=201)
async def create_song(song_data: SongCreate, db: Session = Depends(get_db)):
    new_song = Song(**song_data.dict())
    db.add(new_song)
    db.commit()
    db.refresh(new_song)
    return new_song



# 프리미엄 전용 곡
@router.get("/premium/list", response_model=List[SongResponse])
async def get_premium_songs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """프리미엄 전용 곡 목록"""
    
    songs = db.query(Song).filter(Song.is_premium == True).offset(skip).limit(limit).all()
    
    # 즐겨찾기 여부 확인
    favorite_song_ids = {fav.song_id for fav in db.query(Favorite).filter(Favorite.user_id == current_user.id).all()}
    
    result = []
    for song in songs:
        song_dict = {
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "genre": song.genre,
            "difficulty": song.difficulty,
            "duration": song.duration,
            "is_premium": song.is_premium,
            "video_url": song.video_url,
            "is_favorited": song.id in favorite_song_ids
        }
        result.append(song_dict)
    
    return result

# 인기곡 TOP 20
@router.get("/popular/top", response_model=List[SongResponse])
async def get_popular_songs(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """인기곡 TOP (즐겨찾기 많은 순)"""
    
    # 즐겨찾기 많은 순으로 정렬
    songs = db.query(Song).outerjoin(Favorite).group_by(Song.id).order_by(
        func.count(Favorite.id).desc()
    ).limit(limit).all()
    
    # 즐겨찾기 여부 확인
    favorite_song_ids = {fav.song_id for fav in db.query(Favorite).filter(Favorite.user_id == current_user.id).all()}
    
    result = []
    for song in songs:
        song_dict = {
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "genre": song.genre,
            "difficulty": song.difficulty,
            "duration": song.duration,
            "is_premium": song.is_premium,
            "video_url": song.video_url,
            "is_favorited": song.id in favorite_song_ids
        }
        result.append(song_dict)
    
    return result

# 곡 재생 (일일 제한 체크)
@router.post("/{song_id}/play", response_model=PlayResponse)
async def play_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. 곡 존재 여부 확인
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")

    # 2. 일일 재생 제한 체크
    if not current_user.is_premium:
        # DB에 저장된 숫자를 실시간으로 확인
        if current_user.daily_song_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="일일 무료 곡 수를 모두 사용하셨습니다."
            )

    # 3. 재생 횟수 카운트 증가 및 DB 반영
    current_user.daily_song_count += 1
    db.add(current_user)  # 유저 상태 업데이트 명시
    db.commit()           # DB에 실제 저장
    db.refresh(current_user)

    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "message": f"'{song.title}' 재생을 시작합니다!",
        "remaining_plays": 999 if current_user.is_premium else 3 - current_user.daily_song_count
    }
    
    # 4. DB에 변경사항 저장
    db.commit()
    db.refresh(current_user) # 최신 정보로 갱신

    # 5. 결과 반환
    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "message": f"'{song.title}' 재생을 시작합니다!",
        "remaining_plays": 999 if current_user.is_premium else 3 - current_user.daily_song_count
    }
    
    # 프리미엄 곡 체크
    if song.is_premium and not current_user.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프리미엄 구독이 필요한 곡입니다"
        )
    
    # 프리미엄 사용자는 무제한
    if current_user.is_premium:
        return {
            "success": True,
            "message": "재생을 시작합니다",
            "plays_left": 999
        }
    
    # 무료 사용자 일일 제한 체크 (간단 구현 - 실제로는 별도 PlayLog 모델 필요)
    # TODO: 실제로는 오늘 재생한 곡 수를 DB에서 조회
    plays_today = 0  # 임시
    max_plays = 3
    
    if plays_today >= max_plays:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"무료 사용자는 하루 {max_plays}곡까지 재생 가능합니다. 프리미엄 구독을 고려해보세요!"
        )
    
    # TODO: 실제로는 PlayLog에 재생 기록 저장
    
    plays_left = max_plays - plays_today - 1
    
    return {
        "success": True,
        "message": "재생을 시작합니다",
        "plays_left": plays_left
    }

# 즐겨찾기 추가
@router.post("/{song_id}/favorite")
async def add_favorite(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """즐겨찾기 추가"""
    
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="곡을 찾을 수 없습니다"
        )
    
    # 이미 즐겨찾기한 경우
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.song_id == song_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 즐겨찾기에 추가된 곡입니다"
        )
    
    # 즐겨찾기 추가
    favorite = Favorite(user_id=current_user.id, song_id=song_id)
    db.add(favorite)
    db.commit()
    
    return {"message": "즐겨찾기에 추가되었습니다"}

# 즐겨찾기 삭제
@router.delete("/{song_id}/favorite")
async def remove_favorite(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """즐겨찾기 삭제"""
    
    favorite = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.song_id == song_id
    ).first()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="즐겨찾기를 찾을 수 없습니다"
        )
    
    db.delete(favorite)
    db.commit()
    
    return {"message": "즐겨찾기에서 삭제되었습니다"}

# 내 즐겨찾기 목록
@router.get("/favorites/my-list", response_model=List[SongResponse])
async def get_my_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내 즐겨찾기 목록"""
    
    favorites = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    song_ids = [fav.song_id for fav in favorites]
    
    songs = db.query(Song).filter(Song.id.in_(song_ids)).all()
    
    result = []
    for song in songs:
        song_dict = {
            "id": song.id,
            "title": song.title,
            "artist": song.artist,
            "genre": song.genre,
            "difficulty": song.difficulty,
            "duration": song.duration,
            "is_premium": song.is_premium,
            "video_url": song.video_url,
            "is_favorited": True
        }
        result.append(song_dict)
    
    return result