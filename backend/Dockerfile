FROM python:3.13-slim AS dependencies
WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
FROM python:3.13-slim
RUN useradd --create-home --uid 10001 coffee
WORKDIR /app
COPY --from=dependencies /install /usr/local
COPY --chown=coffee:coffee backend/app ./app
COPY --chown=coffee:coffee backend/migrations ./migrations
COPY --chown=coffee:coffee backend/data ./data
COPY --chown=coffee:coffee backend/artifacts ./artifacts
USER coffee
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers"]
