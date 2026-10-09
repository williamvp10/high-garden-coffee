from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    database_url: str = "postgresql://coffee:coffee@localhost:55433/coffee"
    jwt_secret: str = Field(min_length=32)
    internal_access_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    tavily_api_key: str = ""
    telegram_mode: Literal["auto", "polling", "webhook"] = "auto"
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_internal_users: str = ""
    telegram_bot_username: str = ""
    repository_url: str = ""
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"
    artifact_dir: Path = Path(__file__).resolve().parents[2] / "artifacts"
    agent_timeout_seconds: int = 90
    external_daily_limit: int = 20
    internal_daily_limit: int = 100


settings = Settings()
