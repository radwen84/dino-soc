"""Regression gate: compare current metrics to reference_metrics.json.



Fails (exit 1) if F1 or ROC-AUC drops by more than TOLERANCE (5%).

Creates the reference file on first run if absent.

"""



import json

import os

import sys



MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))

REFERENCE_PATH = os.path.join(os.path.dirname(__file__), "reference_metrics.json")

TOLERANCE = 0.05





def main() -> int:

    metrics_path = os.path.join(MODEL_DIR, "metrics.json")

    if not os.path.exists(metrics_path):

        print(f"ERROR: {metrics_path} not found. Run evaluate.py first.", file=sys.stderr)

        return 1



    with open(metrics_path) as f:

        current = json.load(f)



    if not os.path.exists(REFERENCE_PATH):

        with open(REFERENCE_PATH, "w") as f:

            json.dump({"f1": current["f1"], "roc_auc": current["roc_auc"]}, f, indent=2)

        print("Reference metrics created; no regression check on first run.")

        return 0



    with open(REFERENCE_PATH) as f:

        reference = json.load(f)



    failed = False

    for key in ("f1", "roc_auc"):

        ref = float(reference[key])

        cur = float(current[key])

        min_allowed = ref * (1 - TOLERANCE)

        status = "OK" if cur >= min_allowed else "REGRESSION"

        if cur < min_allowed:

            failed = True

        print(f"{key}: current={cur:.4f} reference={ref:.4f} "

              f"min_allowed={min_allowed:.4f} -> {status}")



    if failed:

        print("Model regression exceeds tolerance.", file=sys.stderr)

        return 1



    print("Model validation passed.")

    return 0





if __name__ == "__main__":

    sys.exit(main())