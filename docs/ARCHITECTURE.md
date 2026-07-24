# 🏗️ Architecture du Mini-SOC

## Vue d'ensemble

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                         │
│     React 18 + TailwindCSS + Recharts           │
│     (Dashboard SOC temps réel)                   │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────┴──────────────────────────┐
│                  BACKEND API                      │
│     NestJS + Prisma + JWT + RBAC                │
│                                                  │
│  ┌─────────┐ ┌──────────┐ ┌────────────────┐   │
│  │  Auth   │ │ Incidents│ │ Threat Intel   │   │
│  │  MFA    │ │ Alerts   │ │ (OTX/MISP/     │   │
│  │  RBAC   │ │ IOC      │ │  AbuseIPDB)    │   │
│  └─────────┘ └──────────┘ └────────────────┘   │
│  ┌─────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Assets  │ │ Reports  │ │ SOAR Playbooks │   │
│  │ Wazuh   │ │ KPI/MTTR │ │ (Auto-response)│   │
│  └─────────┘ └──────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼───────────────┐
        │              │               │
┌───────┴───┐  ┌───────┴───┐  ┌───────┴───────┐
│ PostgreSQL │  │   Redis   │  │  OpenSearch   │
│  (Data)    │  │  (Cache)  │  │  (Logs/IOC)   │
└────────────┘  └───────────┘  └───────────────┘
```

## Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18, Vite, TailwindCSS, Zustand, React Query | Dashboard SOC |
| Backend | NestJS 10, TypeScript, Prisma | API REST + WebSocket |
| Auth | JWT, Passport, TOTP (MFA) | Authentification |
| Database | PostgreSQL 16 | Données structurées |
| Cache | Redis 7 | Sessions, rate limiting |
| Search | OpenSearch 2.15 | Logs, alertes, IOCs |
| SIEM | Wazuh 4.8 | HIDS, FIM, Active Response |
| Monitoring | Prometheus, Grafana, Loki | Métriques, logs, alertes |
| Infra | Docker, Kubernetes, Terraform | Déploiement |
| CI/CD | GitHub Actions / GitLab CI | Pipeline automatisée |
| Security | Helmet, CSP, rate limiting | Hardening |

## Modules Backend

1. **Auth** — JWT + MFA TOTP + account locking
2. **Users** — CRUD + RBAC (admin, L1, L2, L3)
3. **Incidents** — Workflow complet (new → closed) + MTTD/MTTR
4. **Alerts** — Ingestion multi-source + corrélation
5. **IOC** — CRUD + bulk import + expiration + matching
6. **Assets** — Inventaire + sync Wazuh agents
7. **Threat Intel** — OTX + AbuseIPDB + MISP + lookup
8. **Reports** — 6 types + export JSON/CSV/PDF
9. **SOAR** — Playbooks event-driven + auto-response
10. **Audit** — Logging de toutes les actions
11. **Metrics** — Prometheus counters/histograms/gauges
12. **WebSocket** — Notifications temps réel

## Sécurité

- Helmet (14+ headers)
- CSP strict
- CORS whitelist
- Rate limiting (3 tiers)
- Input sanitization (anti-XSS)
- JWT access + refresh rotation
- MFA (TOTP)
- Account locking (5 failed attempts → 30min lock)
- RBAC granulaire
- Audit trail complet
- Secrets via Docker secrets / Vault
- Network policies (zero-trust K8s)
- TLS everywhere

## Performance

- Connection pooling (Prisma)
- Redis caching
- Pagination systématique
- OpenSearch pour full-text search
- Gzip compression
- Docker multi-stage (images <100MB)
- HPA Kubernetes (auto-scaling)


