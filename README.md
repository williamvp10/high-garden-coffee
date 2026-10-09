# High Garden Coffee

Plataforma de analítica y asistente cafetero: una API FastAPI, dashboard y chat Next.js, agente Deep Agents / LangGraph con OpenAI y Tavily, Telegram y memoria PostgreSQL.

## Arranque local

```bash
python3 scripts/init_env.py
docker compose -p high-garden up -d --build
```

- Inicio ejecutivo: http://localhost:3200
- Predicciones por país: http://localhost:3200/predicciones
- Swagger: http://localhost:8200/docs
- PostgreSQL: localhost:55433, base/usuario `coffee`; contraseña en `.env`.

El primer inicio crea el esquema e importa 1.650 observaciones, 550 proyecciones y métricas. Los modelos ya están entrenados y empaquetados. Los ceros del histórico se conservan. Los puertos son configurables en `.env`.

## Despliegue en la VPS con Dokploy

Crear un servicio **Docker Compose**, conectar el repositorio y seleccionar **`compose.dokploy.yaml`**. Configurar variables y dominios en Dokploy siguiendo [la guía de despliegue](docs/DEPLOYMENT.md). Este YAML conserva PostgreSQL en un volumen y expone web/API a través de Traefik, con HTTPS.

## Configurar integraciones

Editar `.env` (ignorado por Git; nunca subirlo):

| Variable | Uso |
|---|---|
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Activar LLM, predeterminado `gpt-4.1-mini`. |
| `TAVILY_API_KEY` | Búsquedas de internet con fuentes. |
| `TELEGRAM_MODE` | `auto` local: polling si no hay webhook. `webhook` para Dokploy. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Bot y enlace visible en la web. |
| `TELEGRAM_WEBHOOK_SECRET` | Secreto del webhook generado al iniciar. |
| `TELEGRAM_INTERNAL_USERS` | IDs numéricos internos separados por comas. |
| `INTERNAL_ACCESS_KEY` | Clave para entrar al modo interno de la web. |
| `REPOSITORY_URL` | Enlace al repositorio remoto cuando se publique. |
| `COOKIE_SECURE` | `true` al servir la web con HTTPS. |

Recrear API y web después de cambiar variables: `docker compose -p high-garden up -d --force-recreate api web`. Sin claves, los dashboards funcionan y el agente informa que no está configurado. No se ejecutan llamadas pagadas durante las pruebas automáticas.

Telegram funciona localmente con `TELEGRAM_MODE=auto` o `polling` sin URL pública. El receptor guarda los updates y cursor en PostgreSQL y respeta cualquier webhook existente. Para producción usar `TELEGRAM_MODE=webhook`; el webhook requiere URL pública HTTPS. Ejecutar `scripts/register_telegram.py --url https://api.tu-dominio.com` después de configurar el bot; este comando **registra** el webhook en Telegram. Solo se procesan chats privados. Las respuestas son persistentes y los updates duplicados se deduplican; el envío es al menos una vez ante una caída entre envío y confirmación.

## Secciones de la web

1. Predicciones: histórico completo por país, comparación de hasta cuatro mercados, ventanas de 1/5/10 años y tabla anual.
2. Experimento: regresión lineal, ETS y ARIMA, validación y prueba.
3. Notebook: dataset, modelos/proyecciones y comparación con explicación de selección; cada figura tiene objetivo y resultado. Incluye HTML ejecutado y descarga `.ipynb`.
4. Garden: conversaciones, streaming, consultas locales y búsquedas con resultados visibles. Telegram usa el mismo agente.

La sesión anónima permanece siete días en cookie HttpOnly. Al salir o cambiar de sesión se conserva el chat en PostgreSQL, pero se cambia su propietario de sesión; esta versión no ofrece recuperación de cuenta ni SSO. El modo interno agrega interpretación ejecutiva y la herramienta del experimento. El dataset y sus métricas son públicos; las conversaciones son privadas por propietario.

## Inicio para dirección

El Inicio reúne el problema de expansión de High Garden, indicadores del conjunto, tres gráficas interactivas y acciones de investigación comercial. `/api/v1/overview` agrega histórico y proyecciones por país: trayectoria conjunta a 1/5/10 años, concentración del último periodo y tamaño frente al incremento absoluto previsto a cinco años. La lista corta de Ethiopia, Viet Nam y Costa Rica prioriza investigación por volumen adicional; no implica rentabilidad ni demanda importada demostrada. Incluye tabla de los 55 países y enlaces a sus predicciones.

## Fundamento del modelo

ARIMA fue seleccionado por MASE en validación, con configuración individual por país; ETS obtuvo mejor MASE en prueba. No se cambia el ganador usando la prueba. La API usa los modelos ajustados sobre los 30 periodos disponibles y verifica SHA-256 del artefacto al arrancar. Sus 550 valores coinciden con el notebook.

**Origen de las proyecciones: 2019/20**, periodos proyectados 2020/21–2029/30. No son pronósticos actuales. Diez años es una extrapolación exploratoria sin validación ni intervalos calibrados. El dataset de consumo no permite predecir precios: se necesita una serie de precios adicional. La unidad original permanece pendiente de verificar.

## Estructura

```text
backend/app/core/       configuración, autorización y PostgreSQL
backend/app/services/   predicción, agente, chat y Telegram
backend/app/main.py     contratos HTTP y ciclo de vida
backend/migrations/    esquema versionado
backend/data/          histórico, métricas y notebook/figuras
backend/artifacts/     ARIMA entrenados y checksum
backend/tests/         pruebas de contrato, modelo y privacidad
frontend/app/          dashboards, notebook, chat y proxy BFF
frontend/components/   interfaz y gráficos
scripts/               configuración, exportación y entrenamiento offline
docs/                  especificación, arquitectura y despliegue
```

## Desarrollo y pruebas

Con PostgreSQL del Compose activo y `DATABASE_URL` local en `.env`:

```bash
python3.13 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8200
```

Frontend: `cd frontend && npm ci && npm run build && npm start -- --port 3200`. Usa `API_BASE_URL=http://localhost:8200` por defecto. La imagen usa exportación standalone. Para ejecutarla directamente: `PORT=3200 node .next/standalone/server.js` (copiar `.next/static` a `.next/standalone/.next/static` primero). Reentrenamiento desde la raíz: `backend/.venv/bin/python scripts/train_models.py`. `prepare_data.py` importa el notebook original desde la carpeta hermana para actualizar la evidencia y necesita `nbconvert/nbformat`; no es necesario para arrancar el repositorio empaquetado.

Pruebas: predicciones vs notebook (todos los países), autorización cruzada, roles y herramientas permitidas, SSE simulado, cuota, deduplicación del webhook y aislamiento real de checkpoints PostgreSQL. La prueba del agente con proveedores reales queda pendiente de las claves.

Ver [especificación](docs/SPEC.md), [arquitectura](docs/ARCHITECTURE.md), [despliegue Dokploy](docs/DEPLOYMENT.md) y [operación](docs/OPERATIONS.md).
