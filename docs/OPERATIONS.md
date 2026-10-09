# Operación y límites

En Dokploy usar `compose.dokploy.yaml`; comprobar salud y logs desde el panel. Los comandos siguientes con `compose.yaml` corresponden al entorno local.

- `docker compose -p high-garden ps`: comprobar salud. `logs --tail=100 api` para fallos de arranque. No pegar claves ni URLs PostgreSQL en reportes.
- `docker compose -p high-garden down` conserva el volumen; **no agregar `-v`** si se quieren conservar conversaciones y memoria.
- Respaldar PostgreSQL con `pg_dump` y las opciones de respaldo de Dokploy. Restaurar en otra base y comprobar conteos antes de sustituir producción.
- Bootstrap usa migración versionada y bloqueo transaccional. Agregar nuevas migraciones al modificar esquema; nunca editar datos productivos silenciosamente.
- Modelo y dataset son artefactos de solo lectura. Cambiar histórico requiere ejecutar nuevamente experimento, validación y entrenamiento; no actualizar solo la fecha de origen.
- Cada sesión web externa tiene propietario UUID firmado; cookies HttpOnly/SameSite. El rol interno se determina con una clave configurada. Telegram usa IDs de usuario/chat y allowlist de IDs internos.
- Cuotas diarias persistidas por propietario: externo 20, interno 100 (variables configurables). Una respuesta simultánea por propietario y cuatro turnos simultáneos por proceso. Tiempo máximo del turno 90 segundos y 40 pasos de grafo. El proxy debe limitar creación de sesiones por IP en despliegue público.
- Herramientas permitidas: histórico, predicción y Tavily; experimento y ranking de oportunidades solo internos. Deep Agents no ofrece shell, archivos ni subagentes. Contenido web se trata como evidencia y no como instrucciones.
- El navegador ve estado, argumentos y resultados de herramientas y texto visible del modelo. No se expone razonamiento privado ni credenciales.
- Telegram inbox deduplica updates; reintentos hasta tres. Un crash después de enviar y antes de marcar `done` puede duplicar una respuesta (entrega al menos una vez).
- Si falta OpenAI, chat responde 503 antes de guardar mensaje. Si falta Tavily, su herramienta explica que no verificó internet.
- Datos numéricos y artefactos son públicos en esta prueba. Los endpoints de chats requieren sesión y validan propietario. No hay panel administrativo para leer chats de terceros.

- Telegram local usa `TELEGRAM_MODE=auto` (polling cuando no hay webhook) o `polling`. El cursor se guarda aparte del inbox, bajo bloqueo de líder; una transacción confirma inbox y cursor. Un webhook existente siempre desactiva polling; no se elimina automáticamente. [Telegram getUpdates](https://core.telegram.org/bots/api#getupdates).
- Las pruebas limpian las claves de proveedor en memoria para impedir que `.env` con credenciales reales inicie recepción de Telegram o llamadas pagadas.
