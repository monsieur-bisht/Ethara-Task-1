from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRETS = {"change-me", "change-me-to-a-long-random-string", "secret"}
POSTGRES_SCHEMES = ("postgres://", "postgresql://", "postgresql+psycopg://")
DEV_DATABASE_URL = "sqlite:///./dev.db"


class Settings(BaseSettings):
    database_url: str | None = None
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:5173"
    # Set ENVIRONMENT=production on Railway/prod to enforce production config.
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def effective_database_url(self) -> str:
        return self.database_url or DEV_DATABASE_URL

    def validate(self) -> None:
        weak = self.jwt_secret in INSECURE_DEFAULT_SECRETS or len(self.jwt_secret) < 32
        if weak:
            raise RuntimeError(
                "JWT_SECRET is missing, default, or shorter than 32 characters. "
                "Set JWT_SECRET in your .env file (or environment). Generate one with:\n"
                "  python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if self.is_production:
            if not self.database_url:
                raise RuntimeError("DATABASE_URL is required when ENVIRONMENT=production.")
            if not self.database_url.startswith(POSTGRES_SCHEMES):
                raise RuntimeError("Production DATABASE_URL must point to PostgreSQL.")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.validate()
    return s
