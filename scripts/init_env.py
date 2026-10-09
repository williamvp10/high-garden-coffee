"""Crear secretos locales sin imprimirlos ni versionarlos."""

from pathlib import Path
import secrets

p = Path(__file__).resolve().parents[1] / ".env"
if p.exists():
    raise SystemExit(".env ya existe; se conserva.")
text = p.with_name(".env.example").read_text()
for name in [
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "INTERNAL_ACCESS_KEY",
    "TELEGRAM_WEBHOOK_SECRET",
]:
    text = text.replace(f"{name}=\n", f"{name}={secrets.token_urlsafe(36)}\n")
password = next(
    line.split("=", 1)[1]
    for line in text.splitlines()
    if line.startswith("POSTGRES_PASSWORD=")
)
port = next(
    line.split("=", 1)[1] for line in text.splitlines() if line.startswith("DB_PORT=")
)
text += f"\nDATABASE_URL=postgresql://coffee:{password}@localhost:{port}/coffee\n"
p.write_text(text)
p.chmod(0o600)
print(
    "Secretos locales creados en .env. Completar integraciones cuando estén disponibles."
)
