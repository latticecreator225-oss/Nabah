# Nabah API — production container (Fly.io).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so this layer caches across code changes.
COPY requirements-prod.txt .
RUN pip install -r requirements-prod.txt

# App code.
COPY . .

# fly.toml sets PORT=8080 and internal_port=8080 to match. Bind uvicorn to it on all interfaces.
# `exec` makes uvicorn PID 1 so it receives SIGTERM for clean shutdowns.
ENV PORT=8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
