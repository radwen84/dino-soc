#!/bin/bash
set -e

# Lancement de JupyterLab en arrière-plan
python3 -m jupyterlab --ip=0.0.0.0 --port=8888 --allow-root --ServerApp.token='' --no-browser &

# Lancement de l'API Uvicorn au premier plan
exec uvicorn main:app --host 0.0.0.0 --port 8000
