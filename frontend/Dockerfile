FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-alpine
WORKDIR /app
RUN addgroup -S -g 10001 coffee && adduser -S -u 10001 -G coffee coffee
COPY --from=build --chown=coffee:coffee /app/.next/standalone ./
COPY --from=build --chown=coffee:coffee /app/.next/static ./.next/static
USER coffee
ENV HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node","server.js"]
