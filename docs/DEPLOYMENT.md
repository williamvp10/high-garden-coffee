# Despliegue en Dokploy con Docker Compose

La VPS ya tiene Dokploy. Desplegar **un servicio Docker Compose** con los tres contenedores: `web`, `api` y `postgres`. El archivo de producción es [`compose.dokploy.yaml`](../compose.dokploy.yaml); [`compose.yaml`](../compose.yaml) conserva el arranque local.

## 1. Conectar el repositorio

En tu proyecto Dokploy, crear un servicio **Docker Compose**, elegir origen Git/GitHub y conectar el repositorio y su rama. Establecer Compose Path en `compose.dokploy.yaml`, situado en la raíz del repositorio. Seleccionar modo **Docker Compose**, que permite construir los Dockerfiles incluidos. El modo Stack requiere imágenes preconstruidas. [Documentación de Compose](https://docs.dokploy.com/docs/core/docker-compose).

El checkout debe incluir `backend/`, `frontend/` y los artefactos entrenados. Los dos builds usan `context: .`; el YAML por sí solo no contiene el código ni los modelos. El repositorio público es https://github.com/williamvp10/high-garden-coffee; conectar la rama que contiene los cambios de despliegue.

## 2. Variables de entorno

En **Environment**, configurar:

| Variable | Valor esperado |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña aleatoria compartida entre PostgreSQL y API. Se aceptan caracteres reservados mediante parámetros separados; hexadecimal facilita copiarla en Environment. |
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
| `REPOSITORY_URL` | `https://github.com/williamvp10/high-garden-coffee` (valor predeterminado). |

Generar cada secreto con `python3 -c "import secrets; print(secrets.token_hex(32))"`. Guardarlos en Dokploy; no versionarlos. El YAML inyecta las variables explícitamente. La API recibe `POSTGRES_HOST=high-garden-coffee-postgres`, puerto `5432`, base/usuario `coffee` y la misma `POSTGRES_PASSWORD` que el contenedor PostgreSQL. Psycopg construye la conexión con parámetros escapados, sin insertar la contraseña en una URL. No agregar `POSTGRES_HOST=localhost` ni pegar la conexión local en Dokploy. `DATABASE_URL` queda como alternativa para desarrollo fuera de Compose. La web recibe solo su URL interna de API y usa cookies seguras con HTTPS.

## 3. Dominios y HTTPS

Crear registros DNS hacia la VPS. En **Domains**, añadir:

| Dominio | Servicio | Puerto del contenedor | Ruta |
|---|---|---|---|
| `highgardencoffee.dokploywill.dpdns.org` | `web` | `3000` | `/` |
| `api.tu-dominio.com` | `api` | `8000` | `/` |

El dominio web confirmado es https://highgardencoffee.dokploywill.dpdns.org/. El dominio `api.tu-dominio.com` es un marcador: sustituirlo por un dominio de API propio si se expondrá el webhook de Telegram o Swagger. La web consulta la API por la red interna y no necesita un segundo dominio para funcionar.

Activar HTTPS/certificado. Dokploy configura las rutas de Traefik desde Domains; no hace falta publicar puertos en el host. Revisar **Preview Compose** para confirmar etiquetas y redes. El YAML conecta web a `dokploy-network` para Traefik y mantiene API/PostgreSQL en la red propia. En Networks del servicio Compose de Dokploy, desactivar la conexión de `api` a `dokploy-network` (detach); Dokploy puede agregar conexiones por defecto. La base tiene el alias privado `high-garden-coffee-postgres`, usado por `POSTGRES_HOST`. Si se agrega un dominio público a API para Telegram/Swagger, permitir su conexión a Traefik y conservar el alias privado de base. Si tu instalación cambió el nombre de la red de Traefik, ajustarlo antes de desplegar. [Dominios de Compose](https://docs.dokploy.com/docs/core/docker-compose/domains).

## 4. Desplegar y verificar

Pulsar **Deploy**. Comprobar salud/logs de los tres servicios y abrir:

- `https://highgardencoffee.dokploywill.dpdns.org/`: Inicio, predicciones, experimento, notebook y chat.
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

La validación local no confirma el estado de la VPS. Verificar los healthchecks y el dominio después de cada despliegue.

## Diagnóstico: `password authentication failed for user "coffee"`

Este error confirma que la API alcanza un PostgreSQL, pero sus credenciales son rechazadas. `pool initialization incomplete` es la consecuencia, no la causa. Aumentar el timeout no corrige la autenticación.

1. Subir los cambios del repositorio y desplegar usando `compose.dokploy.yaml`. La conexión utiliza parámetros separados y elimina la interpretación de caracteres reservados en una URL.
2. En Environment, confirmar que existe una sola definición de `POSTGRES_PASSWORD`. Mantener su valor entre despliegues. No copiar una URL local ni imprimir secretos en logs o capturas. Si hay dólares en un archivo dotenv, conservarlos como valores literales según el parser de Dokploy/Compose; una contraseña hexadecimal evita ambigüedades de interpolación.
3. Si PostgreSQL no pasa el nuevo healthcheck, sincronizar la contraseña almacenada en el usuario. `POSTGRES_PASSWORD` solo inicializa el usuario cuando el directorio de datos está vacío: cambiar Environment no modifica una base ya creada. [Imagen oficial PostgreSQL](https://hub.docker.com/_/postgres).

### Sincronizar la contraseña sin borrar datos

En la terminal del servicio `postgres` en Dokploy:

```bash
psql -U coffee -d coffee
```

Dentro de `psql`:

```text
\password coffee
\q
```

Introducir dos veces la misma contraseña que figura en `POSTGRES_PASSWORD` de Dokploy. `\password` solicita el valor sin escribirlo como SQL visible. [Referencia psql](https://www.postgresql.org/docs/current/app-psql.html).

Si se usa SSH a la VPS, el comando para el contenedor mostrado en el despliegue es:

```bash
docker exec -it high-garden-coffee-app-v5evhs-postgres-1 psql -U coffee -d coffee
```

Después volver a desplegar. Comprobar `postgres → api → web` saludables. No ejecutar `down -v` ni eliminar `coffee_pg`: no es necesario y borraría datos y conversaciones. Si la conexión local por socket fue modificada para exigir contraseña, se necesita la credencial administrativa válida antes de sincronizarla.

### Verificar sin mostrar la contraseña

En la terminal del servicio PostgreSQL:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$(hostname -i)" -U coffee -d coffee -c 'SELECT 1'
```

En la terminal del servicio API, una vez iniciado:

```bash
python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health/ready').read().decode())"
```

El healthcheck usa la IP del contenedor para comprobar autenticación por TCP; `localhost` puede tener regla `trust` y no comprobar la contraseña. El anterior `pg_isready` solo confirmaba disponibilidad del servidor.

## Incidente verificado: DNS de otra base en `dokploy-network`

En la VPS se confirmó que PostgreSQL de High Garden estaba en la red privada con IP `172.26.0.2`, mientras la API conectaba al nombre `postgres` resuelto como `10.0.1.18` en la red compartida. Su healthcheck por localhost pasaba, pero una regla `trust` evitaba comprobar la contraseña. Después de corregir DNS se comprobó un segundo problema: la contraseña almacenada en el usuario no coincidía con la configuración actual, aunque API y PostgreSQL tenían la misma variable.

Se corrigió en Dokploy `serviceNetworks` para `api`: `detachDokployNetwork=true`, conservando la red privada `application` y todos los volúmenes. La vista previa dejó API solo en esa red. El dominio web se corrigió de puerto `3200` (local del host) a `3000` (contenedor). El YAML también usa un alias específico de PostgreSQL para evitar futuras colisiones si la API vuelve a exponerse por Traefik.

Las IPs sirven como evidencia del incidente; no deben fijarse en variables porque Docker puede cambiarlas al recrear contenedores. Comprobar redes y destino antes de atribuir cada fallo de autenticación a una contraseña incorrecta.

La sincronización del usuario `coffee` con el `POSTGRES_PASSWORD` ya configurado requiere `\password coffee` en la terminal de PostgreSQL. Dokploy rechazó el comando temporal de despliegue por contener controles de shell; se retiró sin ejecutar SQL ni modificar datos. El healthcheck del YAML usa la IP del contenedor, evitando el falso positivo de localhost.

Tras sincronizar la contraseña desde la terminal de PostgreSQL, el redeploy de la VPS terminó en `done`, con `postgres`, `api` y `web` saludables. El dominio HTTPS respondió HTTP 200 en catálogo (55 países) y predicción de Vietnam a diez años. La conexión privada y el puerto 3000 del dominio quedan configurados en Dokploy.
