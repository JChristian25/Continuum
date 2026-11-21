FROM python:3.14-slim-bookworm AS api
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /srv/continuum
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates openssh-client && rm -rf /var/lib/apt/lists/*
COPY services/api/requirements.lock services/api/requirements.lock
RUN pip install --no-cache-dir -r services/api/requirements.lock
COPY services/api/pyproject.toml services/api/RELEASE.json services/api/
COPY services/api/releases/ services/api/releases/
COPY services/api/src/ services/api/src/
RUN pip install --no-cache-dir --no-deps -e ./services/api && pip check && python -c "import continuum.main" \
    && useradd --create-home --uid 10001 continuum \
    && install -d -o continuum -g continuum inputs outputs
USER continuum
CMD ["uvicorn", "continuum.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8000"]

FROM node:24-bookworm-slim AS frontend
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/index.html apps/web/vite.config.js ./
COPY apps/web/public/ public/
COPY apps/web/src/ src/
RUN npm run build

FROM caddy:2-alpine AS web
COPY --from=frontend /web/dist/ /srv/web/
COPY self-host/Caddyfile /etc/caddy/Caddyfile
