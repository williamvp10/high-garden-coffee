"""Registrar webhook HTTPS. Nunca imprimir tokens ni el secreto."""

import argparse, os
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
p = argparse.ArgumentParser()
p.add_argument("--url", required=True)
args = p.parse_args()
if not args.url.startswith("https://"):
    raise SystemExit("La URL debe usar HTTPS.")
token = os.getenv("TELEGRAM_BOT_TOKEN")
secret = os.getenv("TELEGRAM_WEBHOOK_SECRET")
if not token or not secret:
    raise SystemExit("Configura TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET.")
try:
    response = httpx.post(
        f"https://api.telegram.org/bot{token}/setWebhook",
        json={
            "url": args.url.rstrip("/") + "/api/v1/telegram/webhook",
            "secret_token": secret,
            "allowed_updates": ["message"],
        },
        timeout=30,
    )
    result = response.json()
    if not response.is_success or not result.get("ok"):
        raise SystemExit("Telegram rechazó el registro; verifica la configuración.")
except httpx.HTTPError:
    raise SystemExit("No se pudo conectar con Telegram.")
print("Webhook registrado correctamente.")
