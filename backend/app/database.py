from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

# Handle Postgres connection strings from Neon
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Ensure sslmode for Neon doesn't break asyncpg if passed in standard query string
# asyncpg prefers ssl=... or sslmode in connect_args
connect_args = {}
if "sqlite" in db_url:
    connect_args["check_same_thread"] = False
elif "neon.tech" in db_url or "sslmode=require" in db_url or "postgresql+asyncpg" in db_url:
    # asyncpg does NOT support sslmode= or channel_binding= in the URL.
    # Strip all non-asyncpg query params and enable SSL via connect_args.
    import re
    db_url = re.sub(r"[?&]sslmode=[^&]+", "", db_url)
    db_url = re.sub(r"[?&]channel_binding=[^&]+", "", db_url)
    db_url = re.sub(r"[?&]ssl=[^&]+", "", db_url)
    # Clean up any dangling ? or & left after removals
    db_url = re.sub(r"\?$", "", db_url)
    connect_args["ssl"] = True

engine_kwargs = {
    "echo": False,
    "future": True,
}

if "sqlite" not in db_url:
    # Pool settings for serverless / Neon PgBouncer
    engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 300,
    })

engine = create_async_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
