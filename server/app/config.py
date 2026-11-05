from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "evident"
    JWT_SECRET: str = "change-me-in-env-use-a-long-random-string-0001"
    JWT_EXPIRE_HOURS: int = 8
    AI_PROVIDER: Literal["gemini", "groq"] = "gemini"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_EMBED_MODEL: str = "gemini-embedding-001"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Similarity thresholds (tune with scripts/calibrate.py on seed data)
    SEM_THRESHOLD: float = 0.72
    SEARCH_MIN: float = 0.55
    MAX_UPLOAD_MB: int = 5

    @property
    def generation_api_key(self) -> str:
        return self.GROQ_API_KEY if self.AI_PROVIDER == "groq" else self.GEMINI_API_KEY

    @property
    def generation_model(self) -> str:
        return self.GROQ_MODEL if self.AI_PROVIDER == "groq" else self.GEMINI_MODEL

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
