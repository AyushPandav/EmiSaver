from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import api_router
from app.api.users import router as users_router
from app.api.messages import router as messages_router
from app.api.loans import router as loans_router
from app.api.dashboard import router as dashboard_router
from app.api.calendar import router as calendar_router
from app.api.risk import router as risk_router
from app.api.simulate import router as simulate_router
from app.api.ai import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (works seamlessly on Neon Postgres & SQLite)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Privacy-preserving on-device-first Personal Loan Inbox & EMI Aggregator API",
    lifespan=lifespan
)

# Enable CORS for React Native mobile client and web debugging
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes under both /api/v1 and root per section 6.6 spec
app.include_router(api_router, prefix=settings.API_V1_STR)

# Also mount directly so paths like /messages/ingest work exactly as listed in prompt table
app.include_router(users_router)
app.include_router(messages_router)
app.include_router(loans_router)
app.include_router(dashboard_router)
app.include_router(calendar_router)
app.include_router(risk_router)
app.include_router(simulate_router)
app.include_router(ai_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "Welcome to EmiSaver API",
        "docs_url": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
