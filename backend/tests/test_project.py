"""Verificar los contratos y privacidad sin llamadas pagadas a proveedores."""

import asyncio, json, uuid
from types import SimpleNamespace
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from app.main import app
from app.core.config import settings
from app.core.db import pool, rows
from app.services.prediction import PredictionService
from app.services.agent import (
    AgentService,
    ALLOWED_PUBLIC,
    ALLOWED_INTERNAL,
    message_text,
)


@pytest.fixture(autouse=True)
def no_live_integrations(monkeypatch):
    """Evitar que pruebas con .env real activen polling o llamadas pagadas."""
    for key in ["openai_api_key", "tavily_api_key", "telegram_bot_token"]:
        monkeypatch.setattr(settings, key, "")


def test_forecasts_match_notebook():
    model = PredictionService()
    reference = pd.read_parquet(settings.data_dir / "country_forecasts.parquet")
    for country in model.models:
        result = model.predict(country, 10)
        assert result["forecast_origin"] == "2019/20"
        assert result["annual_forecasts"][-1]["period"] == "2029/30"
        actual = [r["predicted_consumption"] for r in result["annual_forecasts"]]
        expected = (
            reference[reference.country.eq(country)]
            .sort_values("horizon")
            .predicted_consumption
        )
        np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-3)


def test_opportunity_rankings():
    result = PredictionService().opportunities(5)
    assert sum(result["classification_counts"].values()) == 55
    assert result["top_absolute_growth"][0]["country"] == "Ethiopia"
    assert all(
        r["last_consumption"] >= 1_000_000 for r in result["top_relative_growth"]
    )
    assert all(
        r["absolute_growth"] >= result["top_absolute_growth"][i + 1]["absolute_growth"]
        for i, r in enumerate(result["top_absolute_growth"][:-1])
    )


@pytest.mark.asyncio
async def test_deepagents_tool_permissions(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "not-a-live-key")
    service = AgentService(None)
    for role, allowed in [("external", ALLOWED_PUBLIC), ("internal", ALLOWED_INTERNAL)]:
        graph = service.build(role)
        assert set(graph.nodes["tools"].bound.tools_by_name) == allowed
    assert (
        message_text(
            [
                {"type": "reasoning", "text": "privado"},
                {"type": "text", "text": "visible"},
            ]
        )
        == "visible"
    )


class FakeGraph:
    """La ejecución simulada verifica transporte; no sustituye integración OpenAI."""

    async def astream_events(self, inputs, config, version):
        yield {
            "event": "on_tool_start",
            "name": "consultar_prediccion",
            "run_id": "trace-1",
            "data": {"input": {"country": "Viet Nam", "horizon": 1}},
        }
        yield {
            "event": "on_tool_end",
            "name": "consultar_prediccion",
            "run_id": "trace-1",
            "data": {"output": {"origin": "2019/20", "value": 123}},
        }

    async def aget_state(self, config):
        return SimpleNamespace(
            values={"messages": [AIMessage(content="Respuesta verificada de prueba")]}
        )


def test_api_contract_ownership_and_stream(monkeypatch):
    # PostgreSQL dedicado del proyecto. No borrar histórico ni conversaciones ajenas.
    with TestClient(app) as client:
        assert client.get("/health/ready").json()["models"] == 55
        assert len(client.get("/api/v1/countries").json()) == 55
        assert (
            len(
                client.get("/api/v1/history", params={"country": "Brazil"}).json()[
                    "observations"
                ]
            )
            == 30
        )
        assert (
            client.get(
                "/api/v1/predictions", params={"country": "Brazil", "horizon": 11}
            ).status_code
            == 422
        )
        assert (
            client.get("/api/v1/predictions", params={"country": "Unknown"}).status_code
            == 404
        )
        assert len(client.get("/api/v1/experiment").json()["comparison"]) == 6
        summary = client.get("/api/v1/overview").json()
        reference = pd.read_parquet(settings.data_dir / "country_history.parquet")
        assert summary["countries"] == 55 and summary["records"] == len(reference)
        assert len(summary["annual_totals"]) == 30
        assert len(summary["projected_totals"]) == 10
        last = reference[reference.year.eq(reference.year.max())]
        assert summary["total_consumption"] == pytest.approx(last.consumption.sum())
        assert sum(m["share_pct"] for m in summary["markets"]) == pytest.approx(100)
        assert summary["research_priorities"][0]["country"] == "Ethiopia"
        assert summary["projected_totals"][4]["predicted"] == pytest.approx(
            sum(m["projected_consumption"] for m in summary["markets"])
        )
        assert client.get("/api/v1/assets/analysis.html").status_code == 200
        a = client.post("/api/v1/auth/session", json={}).json()
        b = client.post("/api/v1/auth/session", json={}).json()
        ah = {"Authorization": "Bearer " + a["token"]}
        bh = {"Authorization": "Bearer " + b["token"]}
        assert client.get("/api/v1/auth/me", headers=ah).json() == {"role": "external"}
        assert (
            client.post(
                "/api/v1/auth/session", json={"internal_key": "invalid"}
            ).status_code
            == 401
        )
        conv = client.post("/api/v1/conversations", json={}, headers=ah).json()
        url = "/api/v1/conversations/" + str(conv["id"])
        assert client.get(url, headers=bh).status_code == 404
        assert (
            client.post(
                url + "/stream", headers=bh, json={"message": "hola"}
            ).status_code
            == 404
        )
        monkeypatch.setattr(settings, "openai_api_key", "")
        assert (
            client.post(
                url + "/stream", headers=ah, json={"message": "hola"}
            ).status_code
            == 503
        )
        monkeypatch.setattr(app.state.agent, "build", lambda role: FakeGraph())
        response = client.post(
            url + "/stream", headers=ah, json={"message": "Proyecta Vietnam"}
        )
        events = [
            json.loads(s[6:])
            for s in response.text.splitlines()
            if s.startswith("data: ")
        ]
        assert [e["type"] for e in events] == [
            "status",
            "tool_start",
            "tool_result",
            "answer",
            "done",
        ]
        persisted = client.get(url, headers=ah).json()
        assert [m["kind"] for m in persisted["messages"]] == ["user", "assistant"]
        assert len(persisted["events"]) == 2
        monkeypatch.setattr(settings, "external_daily_limit", 1)
        response = client.post(url + "/stream", headers=ah, json={"message": "otra"})
        assert "límite diario" in response.text
        assert client.get("/api/v1/conversations", headers=bh).json() == []
        # Worker no iniciado (token ausente al entrar al lifespan).
        monkeypatch.setattr(settings, "telegram_bot_token", "dummy")
        monkeypatch.setattr(settings, "telegram_webhook_secret", "test-secret")
        update = {"update_id": int(uuid.uuid4().int % 10**15)}
        assert client.post("/api/v1/telegram/webhook", json=update).status_code == 403
        for _ in range(2):
            assert (
                client.post(
                    "/api/v1/telegram/webhook",
                    json=update,
                    headers={"X-Telegram-Bot-Api-Secret-Token": "test-secret"},
                ).status_code
                == 200
            )

        async def verify():
            count = await rows(
                "SELECT count(*) AS n FROM telegram_updates WHERE update_id=%s",
                (update["update_id"],),
            )
            assert count[0]["n"] == 1

        client.portal.call(verify)


@pytest.mark.asyncio
async def test_postgres_checkpoint_isolation():
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.graph import StateGraph, MessagesState, START, END
    from psycopg_pool import AsyncConnectionPool
    from psycopg.rows import dict_row

    async with AsyncConnectionPool(
        settings.database_conninfo,
        kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": 0},
    ) as local_pool:
        saver = AsyncPostgresSaver(local_pool)
        await saver.setup()
        graph = StateGraph(MessagesState)
        graph.add_node("reply", lambda state: {"messages": [AIMessage(content="ok")]})
        graph.add_edge(START, "reply")
        graph.add_edge("reply", END)
        compiled = graph.compile(checkpointer=saver)
        first = {"configurable": {"thread_id": str(uuid.uuid4())}}
        second = {"configurable": {"thread_id": str(uuid.uuid4())}}
        await compiled.ainvoke({"messages": [("user", "mensaje privado A")]}, first)
        assert (await compiled.aget_state(second)).values == {}
        await compiled.ainvoke({"messages": [("user", "mensaje B")]}, second)
        assert "privado A" not in str((await compiled.aget_state(second)).values)
        assert len((await compiled.aget_state(first)).values["messages"]) == 2


@pytest.mark.asyncio
async def test_polling_inbox_cursor_atomic_and_deduplicated():
    from app.services.telegram import save_updates
    from psycopg import Rollback
    from psycopg_pool import AsyncConnectionPool
    from psycopg.rows import dict_row

    async with AsyncConnectionPool(
        settings.database_conninfo, kwargs={"autocommit": True, "row_factory": dict_row}
    ) as local_pool:
        async with local_pool.connection() as conn:
            async with conn.transaction():
                update = {
                    "update_id": int(uuid.uuid4().int % 10**15),
                    "message": {"text": "prueba"},
                }
                await save_updates(conn, [update, update])
                cur = await conn.execute(
                    "SELECT count(*) AS n FROM telegram_updates WHERE update_id=%s",
                    (update["update_id"],),
                )
                assert (await cur.fetchone())["n"] == 1
                cur = await conn.execute(
                    "SELECT next_offset FROM telegram_poll_state WHERE singleton=true"
                )
                assert (await cur.fetchone())["next_offset"] == update["update_id"] + 1
                # No modificar el cursor ni entregar mensajes falsos al bot real.
                raise Rollback()


def test_database_password_is_not_parsed_as_a_url(monkeypatch):
    from psycopg.conninfo import conninfo_to_dict
    from pydantic import SecretStr

    # Contraseña sintética: caracteres reservados, espacios, comillas y barra inversa.
    password = "demo@host:#%/ ?'\\$end"
    monkeypatch.setattr(settings, "postgres_host", "postgres")
    monkeypatch.setattr(settings, "postgres_password", SecretStr(password))
    parsed = conninfo_to_dict(settings.database_conninfo)
    assert parsed["password"] == password
    assert parsed["host"] == "postgres"
    assert parsed["user"] == "coffee" and parsed["dbname"] == "coffee"
    assert parsed["port"] == "5432"
    monkeypatch.setattr(settings, "postgres_host", "")
    assert settings.database_conninfo == settings.database_url
