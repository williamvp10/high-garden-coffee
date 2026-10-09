import asyncio, contextlib, hmac, json
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID
from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from psycopg.types.json import Jsonb
from app.core.config import settings
from app.core.db import pool, bootstrap, rows, execute
from app.core.security import principal, issue_session
from app.services.prediction import PredictionService, history, experiment
from app.services.overview import overview
from app.services.agent import AgentService
from app.services.chat import owned, new_conversation, run_turn
from app.services.telegram import worker, receiver


@asynccontextmanager
async def lifespan(app):
    await pool.open()
    await pool.wait()
    await bootstrap()
    app.state.prediction = PredictionService()
    app.state.agent = AgentService(app.state.prediction)
    await app.state.agent.checkpointer.setup()
    tasks = (
        [asyncio.create_task(worker(app.state.agent)), asyncio.create_task(receiver())]
        if settings.telegram_bot_token
        else []
    )
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        await pool.close()


app = FastAPI(title="High Garden Coffee API", version="0.1.0", lifespan=lifespan)


class SessionRequest(BaseModel):
    internal_key: str | None = Field(default=None, max_length=200)


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready():
    await rows("SELECT 1")
    return {"status": "ok", "models": len(app.state.prediction.models)}


@app.post("/api/v1/auth/session")
async def session(body: SessionRequest):
    return issue_session(body.internal_key)


@app.get("/api/v1/auth/me")
async def me(p=Depends(principal)):
    return {"role": p["role"]}


@app.get("/api/v1/catalog")
async def catalog():
    countries = await rows("SELECT * FROM countries ORDER BY name")
    return {
        "countries": countries,
        "origin": "2019/20",
        "selected_model": "ARIMA",
        "openai_configured": bool(settings.openai_api_key),
        "tavily_configured": bool(settings.tavily_api_key),
        "telegram_url": (
            f"https://t.me/{settings.telegram_bot_username}"
            if settings.telegram_bot_username
            else None
        ),
        "repository_url": settings.repository_url or None,
    }


@app.get("/api/v1/countries")
async def countries():
    return await rows("SELECT * FROM countries ORDER BY name")


@app.get("/api/v1/history")
async def get_history(country: str = Query(max_length=100)):
    return await history(country)


@app.get("/api/v1/predictions")
async def predictions(
    country: str = Query(max_length=100), horizon: int = Query(default=10, ge=1, le=10)
):
    return await asyncio.to_thread(app.state.prediction.predict, country, horizon)


@app.get("/api/v1/opportunities")
async def opportunities(
    horizon: int = Query(default=5, ge=1, le=10),
    minimum_consumption: float = Query(default=1_000_000, ge=0),
):
    return await asyncio.to_thread(
        app.state.prediction.opportunities, horizon, minimum_consumption
    )


@app.get("/api/v1/overview")
async def get_overview():
    return await overview()


@app.get("/api/v1/experiment")
async def get_experiment(country: str | None = Query(default=None, max_length=100)):
    return await experiment(country)


@app.get("/api/v1/assets")
async def assets():
    return [
        {"name": p.name, "type": "image" if p.suffix == ".png" else "notebook"}
        for p in sorted((settings.data_dir / "assets").iterdir())
        if p.suffix in {".png", ".html", ".ipynb"}
    ]


@app.get("/api/v1/assets/{filename}")
async def asset(filename: str):
    allowed = {
        p.name: p
        for p in (settings.data_dir / "assets").iterdir()
        if p.suffix in {".png", ".html", ".ipynb"}
    }
    if filename not in allowed:
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(
        allowed[filename],
        media_type="text/html" if filename.endswith(".html") else None,
    )


@app.get("/api/v1/conversations")
async def conversations(p=Depends(principal)):
    return await rows(
        "SELECT id,title,channel,role,created_at FROM conversations WHERE owner=%s ORDER BY created_at DESC LIMIT 100",
        (p["owner"],),
    )


@app.post("/api/v1/conversations")
async def create_conversation(p=Depends(principal)):
    return await new_conversation(p)


@app.get("/api/v1/conversations/{identifier}")
async def conversation(identifier: UUID, p=Depends(principal)):
    result = await owned(identifier, p)
    messages = await rows(
        "SELECT id,kind,content,created_at FROM messages WHERE conversation_id=%s ORDER BY id",
        (identifier,),
    )
    events = await rows(
        "SELECT message_id,payload FROM tool_events WHERE conversation_id=%s ORDER BY id",
        (identifier,),
    )
    return {"conversation": result, "messages": messages, "events": events}


@app.post("/api/v1/conversations/{identifier}/stream")
async def stream(identifier: UUID, body: MessageRequest, p=Depends(principal)):
    conversation = await owned(identifier, p)
    # Informar configuración ausente antes de iniciar SSE y de consumir cuota.
    app.state.agent.build(conversation["role"])
    text = body.message.strip()
    if not text:
        raise HTTPException(422, "El mensaje está vacío")

    async def events():
        async for event in run_turn(app.state.agent, conversation, p, text):
            yield "data: " + json.dumps(event, ensure_ascii=False, default=str) + "\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/telegram/webhook")
async def telegram(request: Request):
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not settings.telegram_bot_token or not settings.telegram_webhook_secret:
        raise HTTPException(503, "Telegram no está configurado")
    if not hmac.compare_digest(secret, settings.telegram_webhook_secret):
        raise HTTPException(403, "Webhook no autorizado")
    body = await request.body()
    if len(body) > 65536:
        raise HTTPException(413, "Actualización demasiado grande")
    try:
        payload = json.loads(body)
        identifier = int(payload["update_id"])
        if not 0 <= identifier < 2**63:
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, "Actualización inválida")
    await execute(
        "INSERT INTO telegram_updates(update_id,payload) VALUES(%s,%s) ON CONFLICT(update_id) DO NOTHING",
        (identifier, Jsonb(payload)),
    )
    return {"ok": True}
