from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "EmiSaver API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database (Neon PostgreSQL connection string)
    # Default fallback to sqlite+aiosqlite for local testing if DATABASE_URL not set
    DATABASE_URL: str = "sqlite+aiosqlite:///./emisaver.db"
    
    # NLP & Processing thresholds
    CONFIDENCE_THRESHOLD: float = 0.60
    DEFAULT_LOOKBACK_MONTHS: int = 6
    
    # Security
    API_SECRET: str = "emisaver-dev-secret-key-change-in-production"

    # Mistral AI
    MISTRAL_API_KEY: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
