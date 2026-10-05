"""Extract real network & alert features from OpenSearch for model training."""

import os
import httpx
import numpy as np
from datetime import datetime, timedelta

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_ADMIN_PASSWORD", "admin")

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

def fetch_opensearch_features(hours: int = 168) -> np.ndarray:
    """Fetch Wazuh/Zeek/Suricata alerts from OpenSearch and convert to 10-feature vectors."""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    query = {
        "size": 10000,
        "query": {
            "bool": {
                "must": [
                    {"range": {"timestamp": {"gte": since}}}
                ]
            }
        },
        "sort": [{"timestamp": {"order": "desc"}}],
        "_source": [
            "timestamp", "rule.level", "data.srcip", "data.dstip",
            "data.srcport", "data.dstport", "data.bytes", 
            "data.duration", "data.failed_logins"
        ]
    }

    with httpx.Client(verify=False) as client:
        try:
            response = client.post(
                f"{OPENSEARCH_URL}/wazuh-alerts-*/_search",
                json=query,
                auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"Error connecting to OpenSearch: {e}")
            return np.array([])

    hits = data.get("hits", {}).get("hits", [])
    if not hits:
        print("No documents found in OpenSearch.")
        return np.array([])

    features = []
    for hit in hits:
        src = hit.get("_source", {})
        ts = src.get("timestamp", "")

        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            hour = dt.hour
            day = dt.weekday()
        except (ValueError, TypeError):
            hour = 12
            day = 0

        rule_level = int(src.get("rule", {}).get("level", 3) or 3)
        data_fields = src.get("data", {}) if isinstance(src.get("data"), dict) else {}
        
        src_port = int(data_fields.get("srcport", 0) or 0) % 65536
        dst_port = int(data_fields.get("dstport", 0) or 0) % 65536
        bytes_transferred = int(data_fields.get("bytes", 0) or 0)
        duration = float(data_fields.get("duration", 0.0) or 0.0)
        failed_attempts = int(data_fields.get("failed_logins", 0) or 0)
        
        src_ip = str(data_fields.get("srcip", ""))
        is_internal = 1 if (src_ip.startswith("10.") or src_ip.startswith("192.168.") or src_ip.startswith("172.16.")) else 0
        unique_destinations = 1  # Baseline standard pour un événement unique

        features.append([
            hour, day, rule_level, src_port, dst_port,
            bytes_transferred, duration, failed_attempts,
            unique_destinations, is_internal
        ])

    return np.array(features, dtype=float)
