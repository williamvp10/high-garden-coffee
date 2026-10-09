"""Inbox persistente; no bloquear el webhook mientras responde el agente."""

import asyncio, uuid, json, logging
from psycopg.types.json import Jsonb
import httpx
from app.core.db import pool, execute
from app.core.config import settings
from .chat import new_conversation, run_turn


async def worker(agent):
    while True:
        row = None
        try:
            async with pool.connection() as conn:
                async with conn.transaction():
                    cur = await conn.execute(
                        "SELECT * FROM telegram_updates WHERE (status='queued' OR (status='processing' AND updated_at<now()-interval '3 minutes')) AND attempts<3 ORDER BY update_id FOR UPDATE SKIP LOCKED LIMIT 1"
                    )
                    row = await cur.fetchone()
                    if row:
                        await conn.execute(
                            "UPDATE telegram_updates SET status='processing',attempts=attempts+1,updated_at=now() WHERE update_id=%s",
                            (row["update_id"],),
                        )
            if not row:
                await asyncio.sleep(2)
                continue
            message = row["payload"].get("message", {})
            chat = message.get("chat", {})
            user = message.get("from", {})
            text = message.get("text", "")
            if chat.get("type") != "private" or not text or len(text) > 4000:
                await execute(
                    "UPDATE telegram_updates SET status='ignored' WHERE update_id=%s",
                    (row["update_id"],),
                )
                continue
            owner = f"telegram:{user['id']}:{chat['id']}"
            role = (
                "internal"
                if str(user["id"])
                in {
                    value.strip()
                    for value in settings.telegram_internal_users.split(",")
                }
                else "external"
            )
            principal = {"owner": owner, "role": role}
            identifier = str(uuid.uuid5(uuid.NAMESPACE_URL, owner + ":" + role))
            conversation = await new_conversation(
                principal, "telegram", identifier=identifier
            )
            answer = row.get("response")
            if not answer:
                if text == "/start":
                    answer = "Soy Garden, asistente de café. Puedo consultar históricos y proyecciones desde 2019/20 y buscar contexto actual. ¿Qué te gustaría explorar?"
                else:
                    async for event in run_turn(agent, conversation, principal, text):
                        if event["type"] == "answer":
                            answer = event["text"]
                        elif event["type"] == "error":
                            answer = event["message"]
                answer = answer or "No se pudo completar la respuesta."
                await execute(
                    "UPDATE telegram_updates SET response=%s WHERE update_id=%s",
                    (answer, row["update_id"]),
                )
            async with httpx.AsyncClient(timeout=20) as client:
                for start in range(0, len(answer), 3800):
                    response = await client.post(
                        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                        json={
                            "chat_id": chat["id"],
                            "text": answer[start : start + 3800],
                        },
                    )
                    response.raise_for_status()
            await execute(
                "UPDATE telegram_updates SET status='done',updated_at=now() WHERE update_id=%s",
                (row["update_id"],),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            if "row" in locals() and row:
                await execute(
                    "UPDATE telegram_updates SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,updated_at=now() WHERE update_id=%s",
                    (row["update_id"],),
                )
            await asyncio.sleep(3)


async def save_updates(conn, updates):
    """Guardar inbox y cursor atómicamente antes de confirmar recepción al proveedor."""
    if not updates:
        return
    async with conn.transaction():
        for update in updates:
            await conn.execute(
                "INSERT INTO telegram_updates(update_id,payload) VALUES(%s,%s) ON CONFLICT(update_id) DO NOTHING",
                (update["update_id"], Jsonb(update)),
            )
        await conn.execute(
            "UPDATE telegram_poll_state SET next_offset=%s,updated_at=now() WHERE singleton=true",
            (max(update["update_id"] for update in updates) + 1,),
        )


async def receiver():
    """Local: long polling. Producción: webhook. Auto respeta un webhook existente."""
    if settings.telegram_mode == "webhook":
        return
    logger = logging.getLogger("uvicorn.error")
    async with httpx.AsyncClient(timeout=40) as client:
        while True:
            try:
                async with pool.connection() as conn:
                    cur = await conn.execute(
                        "SELECT pg_try_advisory_lock(786124) AS acquired"
                    )
                    if not (await cur.fetchone())["acquired"]:
                        await asyncio.sleep(5)
                        continue
                    try:
                        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/"
                        info = (await client.get(url + "getWebhookInfo")).json()
                        if not info.get("ok"):
                            raise RuntimeError("Telegram rechazó credenciales")
                        if info["result"].get("url"):
                            logger.info(
                                "Telegram usa webhook existente; polling desactivado."
                            )
                            return
                        logger.info("Telegram long polling activo.")
                        while True:
                            cur = await conn.execute(
                                "SELECT next_offset FROM telegram_poll_state WHERE singleton=true"
                            )
                            offset = (await cur.fetchone())["next_offset"]
                            response = await client.get(
                                url + "getUpdates",
                                params={
                                    "offset": offset,
                                    "timeout": 25,
                                    "allowed_updates": json.dumps(["message"]),
                                },
                            )
                            result = response.json()
                            if not response.is_success or not result.get("ok"):
                                raise RuntimeError("Error de recepción Telegram")
                            await save_updates(conn, result["result"])
                    finally:
                        await conn.execute("SELECT pg_advisory_unlock(786124)")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                # Nunca registrar la URL de Telegram: contiene el token.
                logger.warning(
                    "Telegram recepción temporalmente no disponible (%s).",
                    type(exc).__name__,
                )
                await asyncio.sleep(5)
