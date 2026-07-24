-- Initialisation de la Base SQL de Production du Mini-SOC
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ÉNUMÉRATIONS ET ENUM TYPES
CREATE TYPE incident_severity AS ENUM ('critical', 'high', 'medium', 'low', 'informational');
CREATE TYPE incident_status AS ENUM ('new', 'triaged', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive');
CREATE TYPE alert_status AS ENUM ('new', 'acknowledged', 'escalated', 'resolved');
CREATE TYPE ioc_type AS ENUM ('ip', 'domain', 'url', 'hash_sha256', 'filename');
CREATE TYPE user_role AS ENUM ('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3', 'incident_responder');

-- TABLE : UTILISATEURS DU SOC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    roles user_role[] NOT NULL DEFAULT '{analyst_l1}',
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- TABLE : PARC D'ASSETS SÉCURISÉS (CMDB)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname VARCHAR(255) NOT NULL,
    ip_address INET,
    mac_address MACADDR,
    os VARCHAR(100),
    criticality VARCHAR(50) DEFAULT 'medium',
    wazuh_agent_id VARCHAR(50),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assets_ip ON assets(ip_address);

-- TABLE : CAS D'INCIDENTS
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity incident_severity NOT NULL,
    status incident_status DEFAULT 'new',
    mitre_tactics TEXT[],
    mitre_techniques TEXT[],
    assigned_to UUID REFERENCES users(id),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contained_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft Delete support
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_detected ON incidents(detected_at DESC);

-- TABLE : RECEPTACLE DES ALERTES (LOGS CORRÉLÉS)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id VARCHAR(50) NOT NULL,
    rule_description TEXT,
    level INTEGER,
    source VARCHAR(100), -- 'wazuh', 'suricata', 'falco'
    src_ip INET,
    dst_ip INET,
    mitre_technique VARCHAR(50),
    status alert_status DEFAULT 'new',
    incident_id UUID REFERENCES incidents(id),
    raw_log JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX idx_alerts_mitre ON alerts(mitre_technique);

-- TABLE : BASE DE DONNÉES DES IOCS (INDICATEURS DE COMPROMISSION)
CREATE TABLE ioc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type ioc_type NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    confidence INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    source VARCHAR(255), -- 'misp', 'virustotal', 'abuseipdb'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ioc_unique ON ioc(type, value);

-- TABLE : LOGS D'AUDIT APPLICATIF (RÉPONDRE AUX BESOINS DE CONFORMITÉ)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    details JSONB,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);

-- VUE SYNTHETIQUE : DASHBOARD STATS
CREATE VIEW v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM incidents WHERE status != 'closed') AS open_incidents,
    (SELECT COUNT(*) FROM incidents WHERE severity = 'critical' AND status != 'closed') AS critical_incidents,
    (SELECT COUNT(*) FROM ioc) AS total_iocs;
