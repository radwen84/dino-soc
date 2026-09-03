"""Train the Mini-SOC anomaly-detection model (IsolationForest + StandardScaler).



Produces artifacts the ML Engine (main.py) expects at load time:

  models/anomaly_model.joblib, models/scaler.joblib, models/metadata.json

"""



import json

import os

from datetime import datetime, timezone



import joblib

import numpy as np

from sklearn.ensemble import IsolationForest

from sklearn.preprocessing import StandardScaler



SEED = 42

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))

MODEL_VERSION = "1.0.0"





def load_train():

    path = os.path.join(DATA_DIR, "train.npz")

    if not os.path.exists(path):

        raise FileNotFoundError(f"{path} not found. Run generate_synthetic_data.py first.")

    data = np.load(path, allow_pickle=True)

    return data["x"], data["y"]





def main() -> None:

    os.makedirs(MODEL_DIR, exist_ok=True)

    x_train, _y_train = load_train()



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

    }

    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:

        json.dump(metadata, f, indent=2)



    print(f"Model trained on {x_train.shape[0]} samples -> {MODEL_DIR}")





if __name__ == "__main__":

    main()