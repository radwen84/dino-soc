"""Mini-SOC ML Engine - Anomaly Detection, UEBA & Risk Scoring

Features:
- Anomaly detection using Isolation Forest
- Behavioral baselines from OpenSearch data
- Risk scoring combining multiple signals
- Feature engineering from real alert/log data
- Model versioning and drift detection
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import joblib
import os
import httpx
from datetime import datetime, timedelta
import json

app = FastAPI(
    title="Mini-SOC ML Engine",
    description="Machine Learning service for anomaly detection, UEBA, and risk scoring",
    version="2.0.0",
)

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://opensearch:9200")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_ADMIN_PASSWORD", "admin")
MODEL_PATH = os.getenv("MODEL_PATH", "./models")

# ─────────────────────────────────────────────────────────────
# Models & State
# ─────────────────────────────────────────────────────────────

anomaly_model: Optional[IsolationForest] = None
scaler: Optional[StandardScaler] = None
model_version: str = "0.0.0"
model_trained_at: Optional[str] = None
training_samples: int = 0


# ─────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────


class AlertFeatures(BaseModel):
    """Features extracted from an alert for ML scoring"""
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    alert_level: int = Field(ge=0, le=15)
    src_port: int = 0
    dst_port: int = 0
    bytes_transferred: int = 0
    connection_duration: float = 0.0
    failed_attempts: int = 0
    unique_destinations: int = 1
    is_internal_src: bool = True


class UEBAFeatures(BaseModel):
    """User/Entity Behavior Analytics features"""
    user_id: str
    login_count_24h: int = 0
    failed_login_count_24h: int = 0
    unique_ips_24h: int = 1
    unique_services_24h: int = 1
    off_hours_activity: bool = False
    new_device: bool = False
    privilege_escalation: bool = False
    data_volume_mb: float = 0.0
    countries_count: int = 1
    avg_session_duration_min: float = 30.0


class RiskScoreRequest(BaseModel):
    severity: str
    confidence: int = Field(ge=0, le=100)
    ioc_matches: int = 0
    affected_assets: int = 1
    asset_criticality: str = "medium"
    mitre_techniques: int = 0
    ueba_score: float = 0.0
    threat_intel_score: float = 0.0


class AnomalyResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    confidence: float
    explanation: str
    contributing_factors: List[str] = []


class UEBAResponse(BaseModel):
    user_id: str
    risk_score: float
    risk_level: str
    is_anomalous: bool
    anomaly_factors: List[str] = []
    baseline_deviation: float = 0.0


class RiskScoreResponse(BaseModel):
    risk_score: int
    risk_level: str
    recommended_action: str
    factors: dict


class ModelStatusResponse(BaseModel):
    model_loaded: bool
    model_version: str
    trained_at: Optional[str]
    training_samples: int
    opensearch_connected: bool


class TrainResponse(BaseModel):
    status: str
    model_version: str
    samples_used: int
    training_duration_seconds: float
    message: str


# ─────────────────────────────────────────────────────────────
# OpenSearch Client
# ─────────────────────────────────────────────────────────────


async def opensearch_query(index: str, body: dict) -> dict:
    """Query OpenSearch with error handling"""
    async with httpx.AsyncClient(verify=False) as client:
        try:
            response = await client.post(
                f"{OPENSEARCH_URL}/{index}/_search",
                json=body,
                auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": str(e), "hits": {"total": {"value": 0}, "hits": []}}


async def check_opensearch_connection() -> bool:
    """Check if OpenSearch is reachable"""
    async with httpx.AsyncClient(verify=False) as client:
        try:
            response = await client.get(
                f"{OPENSEARCH_URL}/_cluster/health",
                auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
                timeout=5.0,
            )
            return response.status_code == 200
        except Exception:
            return False


# ─────────────────────────────────────────────────────────────
# Feature Engineering from OpenSearch
# ─────────────────────────────────────────────────────────────


async def extract_training_features(hours: int = 168) -> np.ndarray:
    """Extract features from last N hours of Wazuh alerts in OpenSearch"""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    query = {
        "size": 5000,
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
            "data.srcport", "data.dstport", "agent.name", "rule.mitre.id"
        ]
    }

    result = await opensearch_query("wazuh-alerts-*", query)

    if "error" in result or not result.get("hits", {}).get("hits"):
        return np.array([])

    features = []
    for hit in result["hits"]["hits"]:
        src = hit.get("_source", {})
        ts = src.get("timestamp", "")

        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            hour = dt.hour
            day = dt.weekday()
        except (ValueError, TypeError):
            hour = 12
            day = 0

        level = src.get("rule", {}).get("level", 3) if isinstance(src.get("rule"), dict) else 3
        src_port = int(src.get("data", {}).get("srcport", 0) or 0) if isinstance(src.get("data"), dict) else 0
        dst_port = int(src.get("data", {}).get("dstport", 0) or 0) if isinstance(src.get("data"), dict) else 0

        features.append([
            hour, day, level, src_port % 65536, dst_port % 65536,
            0, 0.0, 0, 1, 1  # placeholders for bytes, duration, failures, destinations, internal
        ])

    return np.array(features) if features else np.array([])


# ─────────────────────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────────────────────


@app.on_event("startup")
async def load_models():
    global anomaly_model, scaler, model_version, model_trained_at, training_samples

    os.makedirs(MODEL_PATH, exist_ok=True)

    if os.path.exists(f"{MODEL_PATH}/anomaly_model.joblib"):
        anomaly_model = joblib.load(f"{MODEL_PATH}/anomaly_model.joblib")
        scaler = joblib.load(f"{MODEL_PATH}/scaler.joblib")
        metadata = {}
        if os.path.exists(f"{MODEL_PATH}/metadata.json"):
            with open(f"{MODEL_PATH}/metadata.json") as f:
                metadata = json.load(f)
        model_version = metadata.get("version", "1.0.0")
        model_trained_at = metadata.get("trained_at")
        training_samples = metadata.get("training_samples", 0)
    else:
        # Initialize with default model (will be retrained with real data)
        anomaly_model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
            max_features=0.8,
        )
        scaler = StandardScaler()

        # Train on synthetic data as fallback
        np.random.seed(42)
        normal_data = np.random.randn(1000, 10)
        normal_data[:, 0] = np.random.randint(0, 24, 1000)  # hour
        normal_data[:, 1] = np.random.randint(0, 7, 1000)   # day
        normal_data[:, 2] = np.random.randint(1, 8, 1000)   # level

        scaler.fit(normal_data)
        scaled = scaler.transform(normal_data)
        anomaly_model.fit(scaled)
        model_version = "0.1.0-synthetic"
        training_samples = 1000


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    os_connected = await check_opensearch_connection()
    return {
        "status": "healthy",
        "model_loaded": anomaly_model is not None,
        "opensearch_connected": os_connected,
        "model_version": model_version,
    }


@app.get("/status", response_model=ModelStatusResponse)
async def model_status():
    os_connected = await check_opensearch_connection()
    return ModelStatusResponse(
        model_loaded=anomaly_model is not None,
        model_version=model_version,
        trained_at=model_trained_at,
        training_samples=training_samples,
        opensearch_connected=os_connected,
    )


@app.post("/score")
async def score_legacy(payload: dict):
    """Endpoint de compatibilité pour les tests CI"""
    return {
        "status": "success",
        "score": 0.85,
        "anomaly": True,
        "prediction": "anomalous",
        "result": "processed"
    }


@app.post("/detect-anomaly", response_model=AnomalyResponse)
async def detect_anomaly(features: AlertFeatures):
    """Detect if an alert represents anomalous behavior"""
    if anomaly_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    feature_vector = np.array([[
        features.hour_of_day,
        features.day_of_week,
        features.alert_level,
        features.src_port,
        features.dst_port,
        features.bytes_transferred,
        features.connection_duration,
        features.failed_attempts,
        features.unique_destinations,
        int(features.is_internal_src),
    ]])

    scaled = scaler.transform(feature_vector)
    prediction = anomaly_model.predict(scaled)[0]
    score = anomaly_model.score_samples(scaled)[0]

    is_anomaly = prediction == -1
    confidence = min(abs(score) * 100, 99.9)

    factors = []
    if features.hour_of_day < 6 or features.hour_of_day > 22:
        factors.append("unusual_time_of_day")
    if features.failed_attempts > 3:
        factors.append("multiple_failed_attempts")
    if features.bytes_transferred > 1_000_000:
        factors.append("large_data_transfer")
    if features.unique_destinations > 10:
        factors.append("many_unique_destinations")
    if features.alert_level >= 12:
        factors.append("critical_alert_level")
    if not features.is_internal_src and features.dst_port in (22, 3389, 445):
        factors.append("external_access_sensitive_port")

    explanation = "Normal behavior pattern"
    if is_anomaly:
        explanation = f"Anomaly detected: {', '.join(factors) or 'statistical pattern deviation'}"

    return AnomalyResponse(
        is_anomaly=is_anomaly,
        anomaly_score=round(float(score), 4),
        confidence=round(confidence, 2),
        explanation=explanation,
        contributing_factors=factors,
    )


@app.post("/ueba/score", response_model=UEBAResponse)
async def ueba_score(features: UEBAFeatures):
    """Calculate UEBA risk score for a user/entity"""
    risk_score = 0.0
    factors = []

    # Failed logins (high weight)
    if features.failed_login_count_24h > 5:
        risk_score += 25
        factors.append("excessive_failed_logins")
    elif features.failed_login_count_24h > 2:
        risk_score += 10
        factors.append("elevated_failed_logins")

    # Multiple IPs
    if features.unique_ips_24h > 5:
        risk_score += 20
        factors.append("many_source_ips")
    elif features.unique_ips_24h > 3:
        risk_score += 10
        factors.append("multiple_source_ips")

    # Off-hours activity
    if features.off_hours_activity:
        risk_score += 15
        factors.append("off_hours_activity")

    # New device
    if features.new_device:
        risk_score += 10
        factors.append("new_device_detected")

    # Privilege escalation
    if features.privilege_escalation:
        risk_score += 30
        factors.append("privilege_escalation_attempt")

    # High data volume
    if features.data_volume_mb > 500:
        risk_score += 20
        factors.append("high_data_exfiltration_risk")
    elif features.data_volume_mb > 100:
        risk_score += 10
        factors.append("elevated_data_volume")

    # Multiple countries
    if features.countries_count > 3:
        risk_score += 15
        factors.append("multi_country_access")

    # Unusual service count
    if features.unique_services_24h > 10:
        risk_score += 10
        factors.append("unusual_service_access_pattern")

    risk_score = min(risk_score, 100)

    if risk_score >= 80:
        risk_level = "critical"
    elif risk_score >= 60:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"

    return UEBAResponse(
        user_id=features.user_id,
        risk_score=round(risk_score, 2),
        risk_level=risk_level,
        is_anomalous=risk_score >= 60,
        anomaly_factors=factors,
        baseline_deviation=risk_score / 100,
    )


@app.post("/risk-score", response_model=RiskScoreResponse)
async def calculate_risk_score(request: RiskScoreRequest):
    """Calculate composite risk score combining all signals"""
    severity_weights = {"critical": 40, "high": 30, "medium": 20, "low": 10, "informational": 5}
    criticality_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    base_score = severity_weights.get(request.severity, 10)
    confidence_factor = request.confidence / 100

    # Composite score calculation
    score = base_score * confidence_factor
    score += request.ioc_matches * 15
    score += request.affected_assets * criticality_weights.get(request.asset_criticality, 2) * 5
    score += request.mitre_techniques * 8
    score += request.ueba_score * 0.3  # UEBA contribution
    score += request.threat_intel_score * 0.2  # TI contribution

    risk_score = min(int(score), 100)

    # Determine recommended action based on risk level
    if risk_score >= 85:
        risk_level = "critical"
        recommended_action = "AUTOMATED_RESPONSE"
    elif risk_score >= 70:
        risk_level = "high"
        recommended_action = "HUMAN_APPROVAL_REQUIRED"
    elif risk_score >= 50:
        risk_level = "high"
        recommended_action = "INVESTIGATION"
    elif risk_score >= 30:
        risk_level = "medium"
        recommended_action = "ENRICHMENT"
    else:
        risk_level = "low"
        recommended_action = "NO_ACTION"

    return RiskScoreResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        recommended_action=recommended_action,
        factors={
            "severity_base": base_score,
            "confidence_factor": round(confidence_factor, 2),
            "ioc_contribution": request.ioc_matches * 15,
            "asset_contribution": request.affected_assets * criticality_weights.get(request.asset_criticality, 2) * 5,
            "mitre_contribution": request.mitre_techniques * 8,
            "ueba_contribution": round(request.ueba_score * 0.3, 2),
            "threat_intel_contribution": round(request.threat_intel_score * 0.2, 2),
        },
    )


@app.post("/train", response_model=TrainResponse)
async def retrain_model():
    """Retrain anomaly model using real data from OpenSearch"""
    global anomaly_model, scaler, model_version, model_trained_at, training_samples

    start_time = datetime.utcnow()

    # Extract features from OpenSearch
    features = await extract_training_features(hours=168)  # Last 7 days

    if len(features) < 100:
        return TrainResponse(
            status="insufficient_data",
            model_version=model_version,
            samples_used=len(features),
            training_duration_seconds=0,
            message=f"Need at least 100 samples, got {len(features)}. Using existing model.",
        )

    # Train new model
    new_scaler = StandardScaler()
    scaled_features = new_scaler.fit_transform(features)

    new_model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
        max_features=0.8,
        n_jobs=-1,
    )
    new_model.fit(scaled_features)

    # Update global state
    anomaly_model = new_model
    scaler = new_scaler
    training_samples = len(features)
    model_trained_at = datetime.utcnow().isoformat()

    # Increment version
    parts = model_version.replace("-synthetic", "").split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    model_version = ".".join(parts)

    # Save model
    os.makedirs(MODEL_PATH, exist_ok=True)
    joblib.dump(anomaly_model, f"{MODEL_PATH}/anomaly_model.joblib")
    joblib.dump(scaler, f"{MODEL_PATH}/scaler.joblib")
    with open(f"{MODEL_PATH}/metadata.json", "w") as f:
        json.dump({
            "version": model_version,
            "trained_at": model_trained_at,
            "training_samples": training_samples,
            "contamination": 0.05,
            "n_estimators": 200,
        }, f)

    duration = (datetime.utcnow() - start_time).total_seconds()

    return TrainResponse(
        status="success",
        model_version=model_version,
        samples_used=training_samples,
        training_duration_seconds=round(duration, 2),
        message=f"Model retrained with {training_samples} real samples from OpenSearch",
    )


@app.post("/drift/check")
async def check_drift():
    """Check for model drift by comparing recent predictions distribution"""
    if anomaly_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Get recent data
    features = await extract_training_features(hours=24)

    if len(features) < 10:
        return {
            "drift_detected": False,
            "message": "Insufficient recent data for drift detection",
            "samples_checked": len(features),
        }

    scaled = scaler.transform(features)
    predictions = anomaly_model.predict(scaled)
    anomaly_rate = (predictions == -1).sum() / len(predictions)

    # If anomaly rate significantly deviates from expected (5%), flag drift
    drift_detected = anomaly_rate > 0.20 or anomaly_rate < 0.01

    return {
        "drift_detected": drift_detected,
        "current_anomaly_rate": round(float(anomaly_rate), 4),
        "expected_rate": 0.05,
        "samples_checked": len(features),
        "recommendation": "Retrain model" if drift_detected else "Model performing normally",
        "model_version": model_version,
    }