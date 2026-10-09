# High Garden Coffee — especificación v1

## Objetivo
Una API y dos canales para consultar consumo histórico, proyecciones y conocimiento cafetero. La API es la autoridad numérica; el LLM interpreta sus herramientas. La web incorpora dashboards, experimento reproducible y chat.

## Requisitos y criterios de aceptación

| ID | Requisito | Criterio |
|---|---|---|
| D01 | Histórico estructurado en PostgreSQL | 55 países × 30 periodos; ceros preservados, claves únicas y origen verificado. |
| P01 | Modelo ARIMA por país | Configuraciones seleccionadas en validación; artefactos reproducibles y endpoint con horizonte 1–10. |
| P02 | Trazabilidad científica | Respuesta incluye origen 2019/20, unidad no verificada y límite del horizonte 10. ETS superó MASE en prueba, aunque ARIMA fue seleccionado en desarrollo. |
| A01 | Deep Agents / LangGraph / LangChain / OpenAI | Herramientas leen los mismos servicios de dominio usados por la API; jamás se inventan pronósticos. |
| A02 | Internet mediante Tavily | Búsquedas limitadas, URLs de fuentes y separación entre dato histórico y contexto actual. Sin clave, herramienta informa indisponibilidad. |
| A03 | Trazas visibles | SSE: estado, inicio de herramienta, resultado, respuesta, fin/error. Se muestra actividad verificable, no razonamiento privado. |
| A04 | Dos audiencias | Externo: herramientas públicas y orientación general. Interno: contexto ejecutivo/diagnósticos. Rol verificado por servidor, nunca por instrucciones del usuario. |
| C01 | Chats persistentes y privados | Conversaciones/mensajes/eventos + checkpoints en PostgreSQL; autorización por propietario en cada operación. |
| T01 | Telegram | Webhook con secreto en producción y long polling local con cursor persistente, usuarios internos en allowlist, chats privados, inbox persistente e idempotente y respuesta del mismo agente. |
| W01 | Next.js | Inicio ejecutivo antes de Predicciones, modelos, notebook/figuras, repositorio configurable y chat con historial/trazas. |
| W02 | Resumen para dirección | KPIs y gráficas agregan los 55 países; lista corta y acciones comerciales sustentadas en el experimento, con límites y tabla de todos los mercados. |
| O01 | Docker Compose | Web/API/PostgreSQL, healthchecks, volumen persistente, puertos locales configurables. |
| O02 | Dokploy | Un servicio Docker Compose con web/API/PostgreSQL, YAML de producción y dominios/HTTPS administrados por Dokploy. |

## Decisiones de alcance
- ARIMA permanece ganador de **validación**, no se reelige con prueba. Su API predice desde el cierre 2019/20; no es un pronóstico actualizado de 2026.
- Dataset/experimento proporcionados son públicos en esta entrega. Chats, checkpoints y contexto de usuarios son privados. Acceso interno agrega herramientas ejecutivas; no se simula un sistema corporativo completo de usuarios.
- Sesiones externas anónimas con JWT y cookie HttpOnly. Acceso interno mediante clave configurable; integrar SSO es una evolución posterior. Telegram identifica propietario y rol por IDs del proveedor.
- No habrá MCP/JEP, envío de correos, código arbitrario, navegación autónoma de shell, órdenes de compra ni recomendaciones de inversión.
- Reentrenamiento fuera del request: script reproducible exporta artefactos. No entrenar usando proyecciones como observaciones.
- Sin claves, dashboards y predicción funcionan; chat devuelve un error explícito. No respuestas LLM falsas en producción.

## Contrato API
Prefijo `/api/v1`. Swagger `/docs`.
- `GET /auth/me`, `POST /auth/session`: sesión externa; clave interna opcional verificada.
- `GET /catalog`, `/countries`, `/history?country=...`, `/predictions?country=...&horizon=...`, `/opportunities?horizon=5`.
- `GET /overview`: totales históricos/proyectados, concentración, indicadores por país y prioridades de investigación a cinco años.
- `GET /experiment`, `/assets`, `/assets/{filename}`: métricas/metadata y figuras/notebook HTML descargable.
- `GET/POST /conversations`, `GET /conversations/{id}`.
- `POST /conversations/{id}/stream`: mensaje y SSE con herramientas/resultados/respuesta.
- `POST /telegram/webhook`: validación del secreto e inbox; worker usa el mismo servicio de chat.
- `GET /health/live`, `/health/ready`: proceso y conectividad.

## Datos
Tablas `countries`, `consumption`, `projections`, `model_metrics`, `conversations`, `messages`, `tool_events`, `telegram_updates`, `telegram_poll_state`, `schema_migrations`, `dataset_versions`. Checkpoints de LangGraph en sus tablas propias. Bootstrap idempotente bajo bloqueo PostgreSQL; importación en transacción. Fecha de actualización de la fuente permanece desconocida.

## Errores y límites
401 sesión inválida, 404 conversación ajena o país inexistente, SSE error para ejecución simultánea, 422 parámetros, SSE error al alcanzar cuota persistente, 503 integración no configurada. Request LLM limitado en tiempo y pasos; herramientas tipadas con límites de resultados. SSE deja errores explícitos; ningún secreto se registra o entrega al navegador.

## Verificación
Pruebas de predicción contra las exportaciones, temporalidad, autorizaciones cruzadas, rol, aislamiento de checkpoints, orden de eventos y webhook idempotente. Build Next.js y Docker; smoke con PostgreSQL real. Integraciones pagadas solo se verifican en vivo cuando se configuren sus claves.
