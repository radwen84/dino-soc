# 🗺️ Mini-SOC Roadmap - 4 Mois

## Vue d'ensemble

| Mois | Focus | Objectif |
|------|-------|----------|
| M1 | Fondations | Infrastructure + Backend core |
| M2 | Sécurité | SIEM + IDS + Detection |
| M3 | Intelligence | TI + SOAR + ML |
| M4 | Production | Hardening + Tests + Deploy |

---

## Mois 1 : Fondations (Semaines 1-4)

### Sprint 1 (S1-S2) : Setup & Backend Core
- [x] Initialisation monorepo
- [x] Docker Compose dev
- [x] Backend NestJS scaffold
- [x] PostgreSQL + Prisma schema
- [x] Auth module (JWT + refresh)
- [x] Users CRUD + RBAC
- [x] Audit logging

### Sprint 2 (S3-S4) : Incidents & Alerts
- [x] Module Incidents (workflow complet)
- [x] Module Alerts (ingestion multi-source)
- [x] Module IOC (CRUD + matching)
- [x] Module Assets (inventaire)
- [x] WebSocket notifications
- [x] OpenSearch integration
- [x] Health checks

---

## Mois 2 : Sécurité (Semaines 5-8)

### Sprint 3 (S5-S6) : SIEM Integration
- [x] Wazuh Manager deployment
- [x] Wazuh rules custom (MITRE mapping)
- [x] FIM configuration
- [x] Active Response setup
- [x] Suricata IDS deployment
- [x] Suricata custom rules
- [x] OpenSearch dashboards

### Sprint 4 (S7-S8) : Network & Runtime Security
- [x] Zeek NSM deployment
- [x] Zeek scripts custom
- [x] Falco runtime security
- [x] Falco rules custom
- [x] YARA rules (malware detection)
- [x] Sigma rules (conversion)
- [x] Log correlation pipeline

---

## Mois 3 : Intelligence (Semaines 9-12)

### Sprint 5 (S9-S10) : Threat Intel & SOAR
- [x] Threat Intel feeds (OTX, AbuseIPDB, MISP)
- [x] IOC enrichment automatique
- [x] SOAR playbooks (NestJS)
- [x] n8n workflows (enrichment, response, notification)
- [x] TheHive integration (case management)
- [x] Cortex analyzers

### Sprint 6 (S11-S12) : ML & Frontend
- [x] ML Engine (anomaly detection)
- [x] Risk scoring API
- [x] React Dashboard complet
- [x] Dashboard temps réel (WebSocket)
- [x] Graphiques Recharts
- [x] Filtres et pagination
- [x] Reports & KPIs (MTTD, MTTR)

---

## Mois 4 : Production (Semaines 13-16)

### Sprint 7 (S13-S14) : Hardening & Infra
- [x] Security hardening (Helmet, CSP, CORS)
- [x] Rate limiting (3 tiers)
- [x] Input sanitization
- [x] Vault (secrets management)
- [x] Docker multi-stage (production)
- [x] Kubernetes manifests
- [x] Helm chart
- [x] Terraform (AWS EKS, RDS)
- [x] Network policies

### Sprint 8 (S15-S16) : Tests, CI/CD & Docs
- [x] Tests unitaires (Jest)
- [x] Tests d'intégration (Supertest + DB)
- [x] Tests E2E (auth flow)
- [x] Tests frontend (Vitest)
- [x] CI/CD GitHub Actions
- [x] CI/CD GitLab CI
- [x] Security pipeline (Semgrep, Trivy, SBOM)
- [x] Monitoring (Prometheus, Grafana, Loki)
- [x] Backup & DR
- [x] Documentation complète
- [x] Plugin engine (extensibility)

---

## Métriques de Succès

| KPI | Cible |
|-----|-------|
| MTTD (Mean Time to Detect) | < 5 minutes |
| MTTR (Mean Time to Respond) | < 30 minutes (critical) |
| Taux de faux positifs | < 10% |
| Couverture MITRE ATT&CK | > 15 techniques |
| Couverture tests backend | > 80% |
| Disponibilité API | > 99.5% |
| Temps de réponse P95 | < 500ms |

---

## Évolutions Futures (Post-PFE)

- [ ] Multi-tenancy
- [ ] SAML/OIDC SSO
- [ ] Kubernetes Operator custom
- [ ] Graph-based threat hunting
- [ ] ML pipeline avec MLflow
- [ ] Mobile app (React Native)
- [ ] Compliance frameworks (ISO 27001, NIST)
- [ ] API marketplace (plugins publics)

