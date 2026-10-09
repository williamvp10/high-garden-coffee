# Interfaz

Aplicación Next.js con App Router. Diseño en español: sidebar permanente en escritorio y navegación horizontal móvil; verde bosque, crema, tipografía de sistema, tarjetas y gráficas legibles. Tokens semánticos CSS, foco visible, estados vacíos/error/carga, movimiento reducido.

Rutas: `/` inicio ejecutivo; `/predicciones` predicción anual y horizonte; `/experimento` comparación de modelos; `/notebook` notebook y galería; `/chat` conversación con eventos verificables y resultados de herramientas. Telegram y repositorio son enlaces configurables; si faltan, se indica sin inventar URL.

Predicciones y cálculos vienen de API. El navegador no recibe claves OpenAI/Tavily/Telegram ni usa valores inventados. Streaming mediante BFF Next.js, cookies HttpOnly, historial por propietario y trazas plegables.

## Iteración: integración real y evidencia visual
- Recharts con altura explícita y tokens existentes; histórico completo por país, comparación de hasta cuatro mercados y proyección en ventanas 1/5/10.
- Notebook con tres secciones: dataset, métodos/proyecciones y comparación/selección. Cada figura explica objetivo e interpretación; puntaje de validación llega de la API.
- Telegram local mediante long polling con cursor persistente; Dokploy mantiene recepción webhook. Secretos solo del servidor.

## Inicio ejecutivo
- `/api/v1/overview` agrega los 55 países del histórico y las proyecciones exportadas del experimento; cálculos y rankings en backend.
- Inicio precede a Predicciones y reúne introducción, KPIs, trayectoria conjunta 1/5/10, participación de mercados y dispersión de tamaño frente a cambio absoluto a cinco años. Tabla accesible con todos los países.
- Lista corta por incremento absoluto: Ethiopia, Viet Nam y Costa Rica; recomendaciones de investigación, actualización de datos y pilotos sujetos a compradores y margen. Explica precios ausentes, consumo vs importaciones, origen 2019/20, unidad sin verificar y horizonte de diez años sin validar.
- Enlaces por mercado abren `/predicciones?country=...`; se conserva la gráfica de observado/proyectado primero.

## Accesos públicos
- Repositorio público: https://github.com/williamvp10/high-garden-coffee; valor predeterminado en ambos Compose y ejemplo de entorno.
- Invitación destacada en Inicio con ejemplo de consulta y acceso directo a Telegram/GitHub; botón de Telegram bajo la navegación, visible también en móvil.

- Autoría visible en el pie de todas las páginas: William David Vasquez Parada. README con enlace destacado a la versión en vivo.
