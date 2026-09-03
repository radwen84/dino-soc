"""Evaluate the trained anomaly model and emit machine-readable metrics.



Writes services/ml-engine/models/metrics.json with precision, recall, F1,

ROC-AUC and confusion matrix. Fails loudly if artifacts are missing.

"""



import json

import os



import joblib

import numpy as np

from sklearn.metrics import (

    confusion_matrix,

    precision_recall_fscore_support,

    roc_auc_score,

)



DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))





def _require(path: str) -> str:

    if not os.path.exists(path):

        raise FileNotFoundError(f"Required file missing: {path}")

    return path





def main() -> None:

    model = joblib.load(_require(os.path.join(MODEL_DIR, "anomaly_model.joblib")))

    scaler = joblib.load(_require(os.path.join(MODEL_DIR, "scaler.joblib")))



    data = np.load(_require(os.path.join(DATA_DIR, "test.npz")), allow_pickle=True)

    x_test, y_true = data["x"], data["y"]



    x_scaled = scaler.transform(x_test)

    y_pred = model.predict(x_scaled)



    true_anom = (y_true == -1).astype(int)

    pred_anom = (y_pred == -1).astype(int)



    precision, recall, f1, _ = precision_recall_fscore_support(

        true_anom, pred_anom, average="binary", zero_division=0

    )



    anomaly_scores = -model.score_samples(x_scaled)

    try:

        roc_auc = roc_auc_score(true_anom, anomaly_scores)

    except ValueError:

        roc_auc = 0.0



    cm = confusion_matrix(true_anom, pred_anom, labels=[0, 1]).tolist()



    metrics = {

        "precision": round(float(precision), 4),

        "recall": round(float(recall), 4),

        "f1": round(float(f1), 4),

        "roc_auc": round(float(roc_auc), 4),

        "confusion_matrix": cm,

        "test_samples": int(x_test.shape[0]),

    }



    with open(os.path.join(MODEL_DIR, "metrics.json"), "w") as f:

        json.dump(metrics, f, indent=2)



    print(json.dumps(metrics, indent=2))





if __name__ == "__main__":

    main()