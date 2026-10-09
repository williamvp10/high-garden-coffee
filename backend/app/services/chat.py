import asyncio, json, uuid
from fastapi import HTTPException
from psycopg.types.json import Jsonb
from app.core.db import pool, rows, execute
from app.core.config import settings
from .agent import ALLOWED_INTERNAL, ALLOWED_PUBLIC, message_text


async def owned(conversation_id, principal):
    result = await rows(
        "SELECT * FROM conversations WHERE id=%s AND owner=%s",
        (conversation_id, principal["owner"]),
    )
    if not result:
        raise HTTPException(404, "Conversación no encontrada")
    return result[0]


async def new_conversation(
    principal, channel="web", title="Nueva conversación", identifier=None
):
    identifier = identifier or str(uuid.uuid4())
    await execute(
        "INSERT INTO conversations(id,owner,role,channel,title) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING",
        (identifier, principal["owner"], principal["role"], channel, title[:100]),
    )
    return await owned(identifier, principal)


# Reservar conexiones para herramientas y healthchecks durante streaming.
_CAPACITY = asyncio.Semaphore(4)


async def run_turn(service, conversation, principal, text):
    async with _CAPACITY:
        async for event in _run_turn(service, conversation, principal, text):
            yield event


async def _run_turn(service, conversation, principal, text):
    # El rol viene de la conversación autorizada, nunca del contenido del mensaje.
    graph = service.build(conversation["role"])
    allowed = ALLOWED_INTERNAL if conversation["role"] == "internal" else ALLOWED_PUBLIC
    async with pool.connection() as lock:
        cur = await lock.execute(
            "SELECT pg_try_advisory_lock(hashtextextended(%s,1)) AS acquired",
            (principal["owner"],),
        )
        if not (await cur.fetchone())["acquired"]:
            yield {
                "type": "error",
                "message": "Ya hay una respuesta en curso para esta sesión.",
            }
            return
        try:
            quota = (
                settings.internal_daily_limit
                if conversation["role"] == "internal"
                else settings.external_daily_limit
            )
            count = await rows(
                "SELECT count(*) AS n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.owner=%s AND m.kind='user' AND m.created_at>now()-interval '1 day'",
                (principal["owner"],),
            )
            if count[0]["n"] >= quota:
                yield {
                    "type": "error",
                    "message": "Se alcanzó el límite diario de mensajes.",
                }
                return
            async with pool.connection() as conn:
                cur = await conn.execute(
                    "INSERT INTO messages(conversation_id,kind,content) VALUES(%s,'user',%s) RETURNING id",
                    (conversation["id"], text),
                )
                message_id = (await cur.fetchone())["id"]
                await conn.execute(
                    "UPDATE conversations SET title=%s WHERE id=%s AND title='Nueva conversación'",
                    (text[:70], conversation["id"]),
                )
            yield {
                "type": "status",
                "message": "Preparando respuesta con el contexto disponible.",
            }
            config = {
                "configurable": {"thread_id": str(conversation["id"])},
                "recursion_limit": 40,
            }
            async with asyncio.timeout(settings.agent_timeout_seconds):
                async for event in graph.astream_events(
                    {"messages": [{"role": "user", "content": text}]},
                    config=config,
                    version="v2",
                ):
                    kind, name = event["event"], event.get("name", "")
                    visible = None
                    if kind == "on_tool_start" and name in allowed:
                        visible = {
                            "type": "tool_start",
                            "id": event["run_id"],
                            "tool": name,
                            "input": event["data"].get("input", {}),
                        }
                    elif kind == "on_tool_end" and name in allowed:
                        output = event["data"].get("output")
                        output = getattr(output, "content", output)
                        if isinstance(output, str):
                            try:
                                output = json.loads(output)
                            except json.JSONDecodeError:
                                pass
                        visible = {
                            "type": "tool_result",
                            "id": event["run_id"],
                            "tool": name,
                            "output": output,
                        }
                    elif kind == "on_chat_model_stream":
                        chunk = event["data"].get("chunk")
                        token = message_text(getattr(chunk, "content", ""))
                        if token:
                            yield {"type": "token", "text": token}
                    if visible:
                        # Persistir la actividad verificable, sin razonamiento interno.
                        payload = json.loads(json.dumps(visible, default=str))
                        await execute(
                            "INSERT INTO tool_events(conversation_id,message_id,event_type,payload) VALUES(%s,%s,%s,%s)",
                            (
                                conversation["id"],
                                message_id,
                                visible["type"],
                                Jsonb(payload),
                            ),
                        )
                        yield payload
                state = await graph.aget_state(config)
                messages = state.values.get("messages", [])
                last = messages[-1] if messages else None
                answer = (
                    message_text(last.content)
                    if getattr(last, "type", "") == "ai"
                    and not getattr(last, "tool_calls", None)
                    else ""
                )
                if not answer:
                    raise RuntimeError("El agente no produjo una respuesta final.")
                await execute(
                    "INSERT INTO messages(conversation_id,kind,content) VALUES(%s,'assistant',%s)",
                    (conversation["id"], answer),
                )
                yield {"type": "answer", "text": answer}
                yield {"type": "done"}
        except asyncio.CancelledError:
            raise
        except Exception:
            # No enviar detalles de credenciales, conexiones o trazas del proveedor.
            yield {
                "type": "error",
                "message": "No se pudo completar la respuesta. Revisa la configuración o vuelve a intentar.",
            }
        finally:
            await lock.execute(
                "SELECT pg_advisory_unlock(hashtextextended(%s,1))",
                (principal["owner"],),
            )
