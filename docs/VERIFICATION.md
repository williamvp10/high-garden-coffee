# Verificación de la entrega

## Comprobado localmente
- Seis pruebas de backend con PostgreSQL real: todos los pronósticos coinciden con el notebook; rankings consistentes; herramientas por rol; autorización por propietario, contratos/SSE/cuota/webhook; checkpoints aislados.
- 55 países y 1.650 observaciones importadas con ceros conservados. 550 proyecciones, horizontes 1–10, último periodo 2029/30.
- Build Next.js con validación TypeScript y construcción de imágenes Docker API/web. Los tres servicios Compose están saludables; las seis pruebas también pasan dentro de la imagen Python 3.13.
- Navegador sin errores de consola después de la revisión final. Revisión en navegador de navegación, selector de ventana, métricas del experimento, galería/notebook y estado del chat sin claves. Revisión de layout móvil.

## Integraciones reales comprobadas · 2026-10-09
- OpenAI: consulta local ARIMA en SSE, con inicio/resultado de herramienta y respuesta final.
- Tavily: Garden usó `buscar_internet`, recuperó cinco fuentes y respondió con un enlace.
- Web: mensaje enviado desde el navegador, resultado local visible y respuesta persistida en el historial.
- Telegram: `/start` y pregunta de proyección enviados por el usuario, recibidos por long polling; ambos inbox `done` al primer intento. La pregunta llamó `consultar_prediccion` y se envió la respuesta con Telegram.
- Recharts: histórico completo, comparación de hasta cuatro países y proyección; tamaños explícitos para renderizar gráficos. Notebook organizado en dataset, métodos/proyecciones y selección.

## Pendiente de publicación
Repositorio remoto, DNS/HTTPS y despliegue Dokploy requieren configuración de la VPS. El funcionamiento local de Telegram usa polling; el webhook de producción todavía debe registrarse con su dominio HTTPS.

Las pruebas crean sesiones/checkpoints exclusivos de prueba; no eliminan información ajena. Para pruebas CI usar una base dedicada, no la base de producción.

## Ajuste de despliegue
La documentación utiliza Dokploy con Docker Compose. `compose.dokploy.yaml` se valida con `docker compose config --quiet`; esta validación no equivale a un despliegue en la VPS.
