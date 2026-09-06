# Stage 1: Build des dépendances
FROM python:3.12-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt


# Stage 2: Image finale
FROM python:3.12-slim

WORKDIR /app

# 1. Création de l'utilisateur non-root
RUN adduser --disabled-password --gecos '' mluser

# 2. Installation des dépendances
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache /wheels/* && rm -rf /wheels

# 3. Pré-création du dossier models et copie des fichiers avec attribution des permissions
RUN mkdir -p /app/models
COPY --chown=mluser:mluser . /app
RUN chown -R mluser:mluser /app

# 4. Passage à l'utilisateur non-root
USER mluser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]