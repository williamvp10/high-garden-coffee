from pathlib import Path
import json
import pandas as pd
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool
from .config import settings

pool = AsyncConnectionPool(
    settings.database_url,
    open=False,
    min_size=2,
    max_size=12,
    kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": 0},
)


async def rows(sql: str, params=()):
    async with pool.connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()


async def execute(sql: str, params=()):
    async with pool.connection() as conn:
        await conn.execute(sql, params)


def safe_records(frame):
    # JSON estándar: nulos explícitos, nunca NaN/Infinity en respuestas.
    return json.loads(frame.to_json(orient="records"))


async def bootstrap():
    async with pool.connection() as conn:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(786123)")
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations(version int PRIMARY KEY, applied_at timestamptz DEFAULT now())"
            )
            migrations = Path(__file__).resolve().parents[2] / "migrations"
            for schema in sorted(migrations.glob("*.sql")):
                version = int(schema.name.split("_", 1)[0])
                cur = await conn.execute(
                    "SELECT version FROM schema_migrations WHERE version=%s", (version,)
                )
                if not await cur.fetchone():
                    await conn.execute(schema.read_text(), prepare=False)
                    await conn.execute(
                        "INSERT INTO schema_migrations(version) VALUES(%s)", (version,)
                    )
            sha = json.loads((settings.data_dir / "manifest.json").read_text())[
                "sha256_dataset"
            ]
            cur = await conn.execute(
                "SELECT sha256 FROM dataset_versions WHERE sha256=%s", (sha,)
            )
            if await cur.fetchone():
                return
            history = pd.read_parquet(settings.data_dir / "country_history.parquet")
            forecasts = pd.read_parquet(settings.data_dir / "country_forecasts.parquet")
            metrics = pd.read_csv(settings.data_dir / "model_evaluation.csv")
            assert len(history) == 1650 and len(forecasts) == 550
            for r in safe_records(
                history[["country", "coffee_type"]].drop_duplicates()
            ):
                await conn.execute(
                    "INSERT INTO countries VALUES(%s,%s) ON CONFLICT(name) DO UPDATE SET coffee_type=EXCLUDED.coffee_type",
                    tuple(r.values()),
                )
            for r in safe_records(history):
                await conn.execute(
                    "INSERT INTO consumption VALUES(%s,%s,%s,%s) ON CONFLICT(country,year) DO UPDATE SET consumption=EXCLUDED.consumption",
                    (r["country"], r["year"], r["period"], r["consumption"]),
                )
            for r in safe_records(forecasts):
                await conn.execute(
                    "INSERT INTO projections VALUES(%s,%s,%s,%s,%s) ON CONFLICT(country,horizon) DO UPDATE SET payload=EXCLUDED.payload,predicted_consumption=EXCLUDED.predicted_consumption",
                    (
                        r["country"],
                        r["horizon"],
                        r["period"],
                        r["predicted_consumption"],
                        Jsonb(r),
                    ),
                )
            for r in safe_records(metrics):
                await conn.execute(
                    "INSERT INTO model_metrics VALUES(%s,%s,%s,%s,%s) ON CONFLICT(country,model_name,stage,horizon) DO UPDATE SET payload=EXCLUDED.payload",
                    (r["country"], r["model_name"], r["stage"], r["horizon"], Jsonb(r)),
                )
            await conn.execute(
                "INSERT INTO dataset_versions(sha256) VALUES(%s)", (sha,)
            )
