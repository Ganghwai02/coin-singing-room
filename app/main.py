from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base

# DB 테이블 생성
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스 체크
@app.get("/")
async def root():
    return {
        "message": f"{settings.APP_NAME} is running!",
        "version": settings.VERSION,
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# API 라우터는 다음 단계에서 추가
# from app.api import songs, users, queue
# app.include_router(songs.router, prefix="/api/songs", tags=["songs"])
# app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(queue.router, prefix="/api/queue", tags=["queue"])