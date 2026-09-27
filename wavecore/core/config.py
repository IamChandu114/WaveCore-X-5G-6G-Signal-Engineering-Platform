from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WaveCore X"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://wavecore:wavecore@localhost:5432/wavecore"
    redis_url: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_prefix="WAVECORE_", env_file=".env")


settings = Settings()

