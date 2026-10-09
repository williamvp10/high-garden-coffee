from pathlib import Path
from typing import Literal
from pydantic import Field, SecretStr
from psycopg.conninfo import make_conninfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    database_url: str = "postgresql://coffee:coffee@localhost:55433/coffee"
    # En Compose los parámetros separados evitan interpretar la contraseña como URL.
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_db: str = "coffee"
    postgres_user: str = "coffee"
    postgres_password: SecretStr = SecretStr("")
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

    @property
    def database_conninfo(self) -> str:
        if not self.postgres_host:
            return self.database_url
        return make_conninfo(
            host=self.postgres_host,
            port=self.postgres_port,
            dbname=self.postgres_db,
            user=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
        )


settings = Settings()
