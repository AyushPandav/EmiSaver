from fastapi import APIRouter
from app.api.users import router as users_router
from app.api.messages import router as messages_router
from app.api.loans import router as loans_router
from app.api.dashboard import router as dashboard_router
from app.api.calendar import router as calendar_router
from app.api.risk import router as risk_router
from app.api.simulate import router as simulate_router
from app.api.privacy import router as privacy_router

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(messages_router)
api_router.include_router(loans_router)
api_router.include_router(dashboard_router)
api_router.include_router(calendar_router)
api_router.include_router(risk_router)
api_router.include_router(simulate_router)
api_router.include_router(privacy_router)

__all__ = ["api_router"]
