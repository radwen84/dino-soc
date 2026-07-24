
"""Mini-SOC ML Engine - Anomaly Detection & Risk Scoring"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

app = FastAPI(
    title="Mini-SOC ML Engine",
    description="Machine Learning service for anomaly detection and risk scoring",
    version="1.0.0",
)

# Models
anomaly_model: Optional[IsolationForest] = None
scaler: Optional[StandardScaler] = None


class AlertFeatures(BaseModel):
    """Features extracted from an alert for ML scoring"""
    hour_of_day: int
    day_of_week: int
    alert_level: int
    src_port: int = 0
    dst_port: int = 0
    bytes_transferred: int = 0
    connection_duration: float = 0.0
    failed_attempts: int = 0
    unique_destinations: int = 1
    is_internal_src: bool = True


class RiskScoreRequest(BaseModel):
    severity: str
    confidence: int
    ioc_matches: int = 0
    affected_assets: int = 1
    asset_criticality: str = "medium"
    mitre_techniques: int = 0


class AnomalyResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    confidence: float
    explanation: str


class RiskScoreResponse(BaseModel):
    risk_score: int
    risk_level: str
    factors: dict


@app.on_event("startup")
async def load_models():
    global anomaly_model, scaler
    model_path = os.getenv("MODEL_PATH", "./models")

    if os.path.exists(f"{model_path}/anomaly_model.joblib"):
        anomaly_model = joblib.load(f"{model_path}/anomaly_model.joblib")
        scaler = joblib.load(f"{model_path}/scaler.joblib")
    else:
        # Train a default model with synthetic data
        anomaly_model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
        )
        scaler = StandardScaler()
        # Generate synthetic normal traffic
        np.random.seed(42)
        normal_data = np.random.randn(1000, 10)
        normal_data[:, 0] = np.random.randint(0, 24, 1000)  # hour
        normal_data[:, 1] = np.random.randint(0, 7, 1000)   # day
        normal_data[:, 2] = np.random.randint(1, 8, 1000)   # level

        scaler.fit(normal_data)
        scaled = scaler.transform(normal_data)
        anomaly_model.fit(scaled)


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": anomaly_model is not None}


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
    confidence = min(abs(score) * 100, 100)

    explanation = "Normal behavior"
    if is_anomaly:
        reasons = []
        if features.hour_of_day < 6 or features.hour_of_day > 22:
            reasons.append("unusual time")
        if features.failed_attempts > 3:
            reasons.append("multiple failures")
        if features.bytes_transferred > 1000000:
            reasons.append("large data transfer")
        if features.unique_destinations > 10:
            reasons.append("many destinations")
        explanation = f"Anomaly detected: {', '.join(reasons) or 'pattern deviation'}"

    return AnomalyResponse(
        is_anomaly=is_anomaly,
        anomaly_score=round(float(score), 4),
        confidence=round(confidence, 2),
        explanation=explanation,
    )


@app.post("/risk-score", response_model=RiskScoreResponse)
async def calculate_risk_score(request: RiskScoreRequest):
    """Calculate composite risk score for an incident/alert"""
    severity_weights = {"critical": 40, "high": 30, "medium": 20, "low": 10, "informational": 5}
    criticality_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    base_score = severity_weights.get(request.severity, 10)
    confidence_factor = request.confidence / 100

    # Composite score calculation
    score = base_score * confidence_factor
    score += request.ioc_matches * 15
    score += request.affected_assets * criticality_weights.get(request.asset_criticality, 2) * 5
    score += request.mitre_techniques * 8

    risk_score = min(int(score), 100)

    if risk_score >= 80:
        risk_level = "critical"
    elif risk_score >= 60:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"

    return RiskScoreResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        factors={
            "severity_base": base_score,
            "confidence_factor": round(confidence_factor, 2),
            "ioc_contribution": request.ioc_matches * 15,
            "asset_contribution": request.affected_assets * criticality_weights.get(request.asset_criticality, 2) * 5,
            "mitre_contribution": request.mitre_techniques * 8,
        },
    )


@app.post("/train")
async def retrain_model():
    """Trigger model retraining (placeholder)"""
    return {
        "status": "training_scheduled",
        "message": "Model retraining will be performed with latest data",
        "timestamp": datetime.utcnow().isoformat(),
    }
