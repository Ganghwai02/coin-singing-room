from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # 앱 설정
    APP_NAME: str = "SingStar API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # 데이터베이스
    DATABASE_URL: str = "sqlite:///./singstar.db"
    
    # JWT 인증
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Redis (큐, 캐싱)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # 파일 저장소
    STORAGE_PATH: str = "./storage"
    AUDIO_PATH: str = "./storage/audio"
    LYRICS_PATH: str = "./storage/lyrics"
    RECORDINGS_PATH: str = "./storage/recordings"
    
    # CORS (프론트엔드 연결) - List로 변경!
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    class Config:
        env_file = ".env"

# 전역 설정 객체
settings = Settings()