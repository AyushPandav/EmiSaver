from typing import Optional
from fastapi import Header, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User


async def get_current_user(
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Device-based session authentication:
    Resolves user by X-Device-Id or X-User-Id.
    Creates user automatically if valid device_id is provided and user doesn't exist yet.
    """
    user = None
    if x_user_id:
        stmt = select(User).where(User.id == x_user_id)
        user = (await db.execute(stmt)).scalar_one_or_none()

    if not user and x_device_id:
        stmt = select(User).where(User.device_id == x_device_id)
        user = (await db.execute(stmt)).scalar_one_or_none()
        if not user:
            # Auto-create user for new device session
            user = User(device_id=x_device_id)
            db.add(user)
            await db.commit()
            await db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid 'X-Device-Id' or 'X-User-Id' header required for authentication."
        )

    return user
