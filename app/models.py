from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    password = Column(String)
    is_premium = Column(Boolean, default=False)
    is_monthly = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    plan_type = Column(String, default="FREE") # FREE, MONTHLY, PREMIUM
    daily_song_count = Column(Integer, default=0) # 오늘 부른 곡 수
    last_active_date = Column(Date) # 날짜가 바뀌면 count를 초기화하기 위함
    
    # 관계
    recordings = relationship("Recording", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")


class Song(Base):
    """곡 모델"""
    __tablename__ = "songs"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    artist = Column(String, nullable=False, index=True)
    genre = Column(String)
    difficulty = Column(Integer, default=3)  # 1-5
    duration = Column(Integer)  # 초 단위
    is_premium = Column(Boolean, default=False)
    
    # 파일 경로
    audio_path = Column(String)
    video_url = Column(String)
    lyrics_path = Column(String)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 관계
    recordings = relationship("Recording", back_populates="song")
    favorites = relationship("Favorite", back_populates="song")


class Recording(Base):
    """녹음 모델"""
    __tablename__ = "recordings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_id = Column(Integer, ForeignKey("songs.id"))
    
    file_path = Column(String)
    score = Column(Float)
    duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 관계
    user = relationship("User", back_populates="recordings")
    song = relationship("Song", back_populates="recordings")


class Favorite(Base):
    """즐겨찾기 모델"""
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_id = Column(Integer, ForeignKey("songs.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 관계
    user = relationship("User", back_populates="favorites")
    song = relationship("Song", back_populates="favorites")


class Queue(Base):
    """예약 큐 모델"""
    __tablename__ = "queue"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, index=True)  # 방 ID (여러 사용자 구분)
    song_id = Column(Integer, ForeignKey("songs.id"))
    position = Column(Integer)  # 순서
    created_at = Column(DateTime, default=datetime.utcnow)

