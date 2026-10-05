"""Train model using real OpenSearch data (with synthetic fallback)."""

import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Import du module d'extraction OpenSearch
from fetch_opensearch_data import fetch_opensearch_features

SEED = 42
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
MODEL_VERSION = "2.0.0-opensearch"

def load_training_data():
    """Try loading real OpenSearch data, fallback to train.npz if < 100 samples."""
    print("Fetching training data from OpenSearch...")
    x_real = fetch_opensearch_features(hours=168)  # 7 derniers jours
    
    if len(x_real) >= 100:
        print(f"Successfully fetched {len(x_real)} real log entries from OpenSearch.")
        return x_real
    
    print(f"Insufficient OpenSearch data ({len(x_real)} samples). Falling back to synthetic train.npz...")
    npz_path = os.path.join(DATA_DIR, "train.npz")
    if not os.path.exists(npz_path):
        raise FileNotFoundError(f"{npz_path} not found.")
    data = np.load(npz_path, allow_pickle=True)
    return data["x"]

def main() -> None:
    os.makedirs(MODEL_DIR, exist_ok=True)
    x_train = load_training_data()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x_train)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        max_features=0.8,
        random_state=SEED,
        n_jobs=-1,
    )
    model.fit(x_scaled)

    joblib.dump(model, os.path.join(MODEL_DIR, "anomaly_model.joblib"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))

    metadata = {
        "version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_samples": int(x_train.shape[0]),
        "contamination": 0.05,
        "n_estimators": 200,
        "max_features": 0.8,
        "random_state": SEED,
        "algorithm": "IsolationForest",
        "data_source": "OpenSearch" if len(x_train) >= 100 else "Synthetic",
    }
    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Model successfully trained on {x_train.shape[0]} samples -> {MODEL_DIR}")

if __name__ == "__main__":
    main()
