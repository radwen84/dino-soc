-- Initialisation de la Base SQL de Production du Mini-SOC

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- ENUMS alignes avec schema.prisma
-- ==========================================

CREATE TYPE "IncidentSeverity" AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'informational'
);

CREATE TYPE "IncidentStatus" AS ENUM (
    'new',
    'triaged',
    'investigating',
    'contained',
    'eradicated',
    'recovered',
    'closed',
    'false_positive'
);

CREATE TYPE "AlertStatus" AS ENUM (
    'new',
    'acknowledged',
    'escalated',
    'resolved',
    'false_positive'
);

CREATE TYPE "IOCType" AS ENUM (
    'ip',
    'domain',
    'url',
    'hash_md5',
    'hash_sha256',
    'hash_sha1',
    'email',
    'filename',
    'registry_key',
    'mutex',
    'user_agent',
    'cidr'
);

CREATE TYPE "IOCStatus" AS ENUM (
    'active',
    'expired',
    'revoked'
);

CREATE TYPE "AssetCriticality" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

-- ==========================================
-- TABLE : USERS
-- Prisma model User @@map("users")
-- ==========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY['analyst_l1'],
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_secret VARCHAR(255),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ==========================================
-- TABLE : INCIDENTS
-- Prisma model Incident @@map("incidents")
-- ==========================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity "IncidentSeverity" NOT NULL,
    status "IncidentStatus" NOT NULL DEFAULT 'new',
    category VARCHAR(100),

    mitre_tactics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    mitre_techniques TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    escalated_to_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,

    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    contained_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,

    affected_assets TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    affected_users TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    business_impact TEXT,

    risk_score INTEGER,

    containment_actions JSONB NOT NULL DEFAULT '[]'::JSONB,
    remediation_steps JSONB NOT NULL DEFAULT '[]'::JSONB,
    lessons_learned TEXT,

    source VARCHAR(100),
    source_alert_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tags JSONB NOT NULL DEFAULT '[]'::JSONB,

    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_assigned_to_id ON incidents(assigned_to_id);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);

-- ==========================================
-- TABLE : ALERTS
-- Prisma model Alert @@map("alerts")
-- ==========================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    rule_id VARCHAR(50),
    rule_description TEXT,
    level INTEGER,
    source VARCHAR(100),

    agent_id VARCHAR(50),
    agent_name VARCHAR(255),

    src_ip VARCHAR(45),
    dst_ip VARCHAR(45),
    src_port INTEGER,
    dst_port INTEGER,

    mitre_tactic VARCHAR(100),
    mitre_technique VARCHAR(50),

    status "AlertStatus" NOT NULL DEFAULT 'new',
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL ON UPDATE CASCADE,

    raw_log JSONB,

    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_level ON alerts(level DESC);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX idx_alerts_src_ip ON alerts(src_ip);
CREATE INDEX idx_alerts_incident_id ON alerts(incident_id);
CREATE INDEX idx_alerts_mitre_technique ON alerts(mitre_technique);

-- ==========================================
-- TABLE : IOCs
-- Prisma model IOC @@map("iocs")
-- ==========================================

CREATE TABLE iocs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type "IOCType" NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    status "IOCStatus" NOT NULL DEFAULT 'active',

    confidence INTEGER NOT NULL DEFAULT 50,
    severity "IncidentSeverity" NOT NULL DEFAULT 'medium',

    source VARCHAR(255),
    source_reference TEXT,

    mitre_techniques TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    related_incidents TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tags JSONB NOT NULL DEFAULT '[]'::JSONB,

    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT iocs_type_value_key UNIQUE (type, value)
);

CREATE INDEX idx_iocs_value ON iocs(value);
CREATE INDEX idx_iocs_type ON iocs(type);
CREATE INDEX idx_iocs_status ON iocs(status);

-- ==========================================
-- TABLE : ASSETS
-- Prisma model Asset @@map("assets")
-- ==========================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    os VARCHAR(100),
    os_version VARCHAR(50),

    criticality "AssetCriticality" NOT NULL DEFAULT 'medium',

    owner VARCHAR(255),
    department VARCHAR(255),
    location VARCHAR(255),

    tags JSONB NOT NULL DEFAULT '[]'::JSONB,

    last_seen TIMESTAMP WITH TIME ZONE,
    wazuh_agent_id VARCHAR(50),

    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_ip_address ON assets(ip_address);
CREATE INDEX idx_assets_hostname ON assets(hostname);
CREATE INDEX idx_assets_wazuh_agent_id ON assets(wazuh_agent_id);

-- ==========================================
-- TABLE : AUDIT LOGS
-- Prisma model AuditLog @@map("audit_logs")
-- ==========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),

    details JSONB NOT NULL DEFAULT '{}'::JSONB,

    ip_address VARCHAR(45),
    user_agent TEXT,

    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ==========================================
-- TABLE : PLAYBOOKS
-- Prisma model Playbook @@map("playbooks")
-- ==========================================

CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    trigger_conditions JSONB NOT NULL,
    actions JSONB NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER NOT NULL DEFAULT 0,

    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- VUE : DASHBOARD STATS
-- ==========================================

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM incidents WHERE status != 'closed') AS open_incidents,
    (SELECT COUNT(*) FROM incidents WHERE severity = 'critical' AND status != 'closed') AS critical_incidents,
    (SELECT COUNT(*) FROM alerts WHERE status = 'new') AS new_alerts,
    (SELECT COUNT(*) FROM iocs) AS total_iocs,
    (SELECT COUNT(*) FROM assets WHERE is_active = true) AS active_assets;