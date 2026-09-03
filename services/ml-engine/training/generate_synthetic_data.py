"""Generate reproducible synthetic SOC data for anomaly-detection training.



Produces exactly 2100 train + 550 test samples with realistic normal traffic

and injected anomalies. Feature order matches the ML Engine AlertFeatures:

[hour_of_day, day_of_week, alert_level, src_port, dst_port,

 bytes_transferred, connection_duration, failed_attempts,

 unique_destinations, is_internal_src]

"""



import json

import os



import numpy as np



SEED = 42

N_TRAIN = 2100

N_TEST = 550

ANOMALY_RATIO = 0.05



DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))



FEATURE_NAMES = [

    "hour_of_day",

    "day_of_week",

    "alert_level",

    "src_port",

    "dst_port",

    "bytes_transferred",

    "connection_duration",

    "failed_attempts",

    "unique_destinations",

    "is_internal_src",

]





def _generate_normal(n: int, rng: np.random.Generator) -> np.ndarray:

    """Normal SOC activity: business hours, low alert level, internal traffic."""

    hour = rng.integers(7, 20, n)

    day = rng.integers(0, 5, n)

    level = rng.integers(1, 6, n)

    src_port = rng.integers(1024, 65535, n)

    dst_port = rng.choice([80, 443, 3306, 5432, 8080], n)

    bytes_transferred = rng.integers(200, 200_000, n)

    connection_duration = rng.uniform(0.1, 60.0, n)

    failed_attempts = rng.integers(0, 2, n)

    unique_destinations = rng.integers(1, 4, n)

    is_internal_src = np.ones(n, dtype=int)

    return np.column_stack([

        hour, day, level, src_port, dst_port, bytes_transferred,

        connection_duration, failed_attempts, unique_destinations, is_internal_src,

    ]).astype(float)





def _generate_anomalies(n: int, rng: np.random.Generator) -> np.ndarray:

    """Malicious activity: off-hours, high level, exfiltration, bruteforce."""

    hour = rng.choice([0, 1, 2, 3, 4, 23], n)

    day = rng.choice([5, 6], n)

    level = rng.integers(10, 16, n)

    src_port = rng.integers(1024, 65535, n)

    dst_port = rng.choice([22, 445, 3389, 4444, 31337], n)

    bytes_transferred = rng.integers(1_000_000, 50_000_000, n)

    connection_duration = rng.uniform(60.0, 600.0, n)

    failed_attempts = rng.integers(10, 100, n)

    unique_destinations = rng.integers(10, 50, n)

    is_internal_src = np.zeros(n, dtype=int)

    return np.column_stack([

        hour, day, level, src_port, dst_port, bytes_transferred,

        connection_duration, failed_attempts, unique_destinations, is_internal_src,

    ]).astype(float)





def _build_dataset(n_total: int, rng: np.random.Generator):

    n_anomaly = int(round(n_total * ANOMALY_RATIO))

    n_normal = n_total - n_anomaly

    normal = _generate_normal(n_normal, rng)

    anomalies = _generate_anomalies(n_anomaly, rng)

    x = np.vstack([normal, anomalies])

    y = np.concatenate([np.ones(n_normal, dtype=int), -np.ones(n_anomaly, dtype=int)])

    idx = rng.permutation(n_total)

    return x[idx], y[idx]





def main() -> None:

    os.makedirs(DATA_DIR, exist_ok=True)

    rng = np.random.default_rng(SEED)



    x_train, y_train = _build_dataset(N_TRAIN, rng)

    x_test, y_test = _build_dataset(N_TEST, rng)



    assert x_train.shape == (N_TRAIN, len(FEATURE_NAMES)), x_train.shape

    assert x_test.shape == (N_TEST, len(FEATURE_NAMES)), x_test.shape



    np.savez(os.path.join(DATA_DIR, "train.npz"),

             x=x_train, y=y_train, feature_names=np.array(FEATURE_NAMES))

    np.savez(os.path.join(DATA_DIR, "test.npz"),

             x=x_test, y=y_test, feature_names=np.array(FEATURE_NAMES))



    summary = {

        "seed": SEED,

        "train_samples": int(N_TRAIN),

        "test_samples": int(N_TEST),

        "anomaly_ratio": ANOMALY_RATIO,

        "feature_names": FEATURE_NAMES,

    }

    with open(os.path.join(DATA_DIR, "dataset_summary.json"), "w") as f:

        json.dump(summary, f, indent=2)



    print(f"Generated {N_TRAIN} train and {N_TEST} test samples in {DATA_DIR}")





if __name__ == "__main__":

    main()


