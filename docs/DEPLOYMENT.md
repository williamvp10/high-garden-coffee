# Despliegue en Dokploy con Docker Compose

La VPS ya tiene Dokploy. Desplegar **un servicio Docker Compose** con los tres contenedores: `web`, `api` y `postgres`. El archivo de producción es [`compose.dokploy.yaml`](../compose.dokploy.yaml); [`compose.yaml`](../compose.yaml) conserva el arranque local.

## 1. Conectar el repositorio

En tu proyecto Dokploy, crear un servicio **Docker Compose**, elegir origen Git/GitHub y conectar el repositorio y su rama. Establecer Compose Path en `compose.dokploy.yaml`, situado en la raíz del repositorio. Seleccionar modo **Docker Compose**, que permite construir los Dockerfiles incluidos. El modo Stack requiere imágenes preconstruidas. [Documentación de Compose](https://docs.dokploy.com/docs/core/docker-compose).

El checkout debe incluir `backend/`, `frontend/` y los artefactos entrenados. Los dos builds usan `context: .`; el YAML por sí solo no contiene el código ni los modelos. El repositorio remoto todavía debe publicarse/conectarse.

## 2. Variables de entorno

En **Environment**, configurar:

| Variable | Valor esperado |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña aleatoria; usar caracteres seguros para URL, por ejemplo hexadecimal. |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `INTERNAL_ACCESS_KEY` | Clave privada de acceso interno. |
| `OPENAI_API_KEY` | Clave OpenAI para activar Garden. |
| `OPENAI_MODEL` | `gpt-4.1-mini` o el modelo que configures. |
| `TAVILY_API_KEY` | Clave de búsqueda web. |
| `TELEGRAM_MODE` | `webhook` para recepción en la VPS; es el valor predeterminado del YAML Dokploy. |
| `TELEGRAM_BOT_TOKEN` | Token del bot. |
| `TELEGRAM_WEBHOOK_SECRET` | Secreto aleatorio para validar Telegram. |
| `TELEGRAM_BOT_USERNAME` | Nombre del bot, sin `@`. |
| `TELEGRAM_INTERNAL_USERS` | IDs internos separados por comas, opcional. |
| `REPOSITORY_URL` | URL pública del repositorio, opcional. |

Generar cada secreto con `python3 -c "import secrets; print(secrets.token_hex(32))"`. Guardarlos en Dokploy; no versionarlos. El YAML inyecta las variables explícitamente. `DATABASE_URL` se construye con el servicio `postgres`; no copiar la conexión `localhost` del entorno local. La web recibe solo su URL interna de API y usa cookies seguras con HTTPS.

## 3. Dominios y HTTPS

Crear registros DNS hacia la VPS. En **Domains**, añadir:

| Dominio de ejemplo | Servicio | Puerto del contenedor | Ruta |
|---|---|---|---|
| `cafe.tu-dominio.com` | `web` | `3000` | `/` |
| `api.tu-dominio.com` | `api` | `8000` | `/` |

Activar HTTPS/certificado. Dokploy configura las rutas de Traefik desde Domains; no hace falta publicar puertos en el host. Revisar **Preview Compose** para confirmar etiquetas y redes. El YAML usa `dokploy-network` externa para Traefik y una red propia para comunicación entre servicios; PostgreSQL queda únicamente en la red propia. Si tu instalación cambió el nombre de la red de Traefik, ajustarlo antes de desplegar. [Dominios de Compose](https://docs.dokploy.com/docs/core/docker-compose/domains).

## 4. Desplegar y verificar

Pulsar **Deploy**. Comprobar salud/logs de los tres servicios y abrir:

- `https://cafe.tu-dominio.com`: dashboard, experimento, notebook y chat.
- `https://api.tu-dominio.com/health/ready`: API lista y modelos cargados.
- `https://api.tu-dominio.com/docs`: contrato API.

Probar que el chat muestra eventos progresivamente. La respuesta SSE del backend/BFF desactiva buffering; cualquier proxy adicional debe permitir streaming y tiempos superiores a los 90 segundos del turno. El primer arranque importa los datos y crea las tablas de chats/checkpoints.

## 5. Telegram

Con API accesible por HTTPS y variables del bot configuradas, registrar desde la máquina local:

```bash
backend/.venv/bin/python scripts/register_telegram.py --url https://api.tu-dominio.com
```

El script lee el `.env` local: sus valores de bot y secreto deben coincidir con Dokploy. Registra `/api/v1/telegram/webhook` y después permite probar el enlace al bot mostrado en la web.

## Persistencia y actualizaciones

`coffee_pg` conserva histórico, conversaciones y memoria. Mantener el nombre del proyecto y del volumen entre despliegues. Configurar copias de seguridad en Dokploy y respaldos lógicos `pg_dump`; verificar restauración. No eliminar el volumen al recrear contenedores. [Volúmenes de Compose](https://docs.dokploy.com/docs/core/docker-compose).

## Si prefieres pegar solo el YAML

La modalidad Raw necesita que el código esté disponible para los builds, o utilizar imágenes ya publicadas. Para un despliegue basado únicamente en YAML, construir/publicar ambas imágenes en tu registry y reemplazar `build` por `image: TU_REGISTRY/high-garden-api:VERSION` y `image: TU_REGISTRY/high-garden-web:VERSION`. El flujo Git de arriba ya permite construir directamente desde este repositorio. [Ejemplo de despliegue](https://docs.dokploy.com/docs/core/docker-compose/example).

Esta entrega prepara archivos y documentación; todavía no se ha desplegado en la VPS.
