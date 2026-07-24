# 🛡️ Mini-SOC Platform

> Conception et mise en œuvre d'une plateforme intelligente de supervision et de détection des incidents de cybersécurité

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5.svg)](https://kubernetes.io/)

---

## 📋 Table des matières

- [Présentation](#-présentation)
- [Architecture](#-architecture)
- [Stack Technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Installation rapide](#-installation-rapide)
- [Déploiement Production](#-déploiement-production)
- [Structure du projet](#-structure-du-projet)
- [Documentation](#-documentation)
- [Contribuer](#-contribuer)
- [Licence](#-licence)

---

## 🎯 Présentation

Mini-SOC est une plateforme open source de **Security Operations Center** offrant :

- **Détection multi-couche** : Host (Wazuh), Réseau (Suricata/Zeek), Runtime (Falco)
- **Corrélation avancée** avec mapping MITRE ATT&CK
- **Réponse automatisée** via playbooks SOAR (n8n)
- **Threat Intelligence** intégrée (VirusTotal, AbuseIPDB, MISP, OTX)
- **Dashboard SOC temps réel** avec heatmap MITRE, timeline incidents, score de risque
- **DevSecOps** complet avec pipeline CI/CD sécurisée
- **Zero Trust Architecture** avec Vault, mTLS, RBAC granulaire

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MINI-SOC PLATFORM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Suricata │  │   Zeek   │  │  Wazuh   │  │  Falco   │   │
│  │  (NIDS)  │  │  (NSM)   │  │  (HIDS)  │  │(Runtime) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┼─────────────┼─────────────┘          │
│                      ▼             ▼                         │
│  ┌─────────────────────────────────────────────────┐        │
│  │         Wazuh Manager (Correlation Engine)       │        │
│  │       + Sigma Rules + MITRE ATT&CK Mapping      │        │
│  └──────────────────────┬──────────────────────────┘        │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │        OpenSearch (SIEM Data Lake)               │        │
│  └──────────────────────┬──────────────────────────┘        │
│                          ▼                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  NestJS    │  │ Prometheus │  │  n8n SOAR  │            │
│  │  API GW    │  │ + Grafana  │  │ (Playbooks)│            │
│  └─────┬──────┘  └────────────┘  └────────────┘            │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │   Nginx (Reverse Proxy + WAF + Rate Limiting)   │        │
│  └──────────────────────┬──────────────────────────┘        │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │        React Dashboard (SOC Console)             │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  Support: PostgreSQL │ Redis │ Vault │ MISP │ TheHive       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Stack Technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand, Socket.IO |
| Backend | NestJS 10, TypeScript, Prisma ORM, BullMQ, JWT/OAuth2 |
| Database | PostgreSQL 16, Redis 7 |
| SIEM | Wazuh 4.9, OpenSearch 2.14 |
| IDS/NSM | Suricata, Zeek, Falco, YARA |
| SOAR | n8n (workflows automatisés) |
| Secrets | HashiCorp Vault |
| Monitoring | Prometheus, Grafana, AlertManager, Loki |
| Proxy | Nginx (TLS, WAF, Rate Limiting) |
| Container | Docker, Docker Compose, Kubernetes, Helm |
| IaC | Terraform, Ansible |
| CI/CD | GitHub Actions, GitLab CI/CD |
| Security | Trivy, Semgrep, SonarQube, TruffleHog |

---

## 📦 Prérequis

- Docker >= 24.0 & Docker Compose >= 2.20
- Node.js >= 20 LTS
- Git >= 2.40
- 16 GB RAM minimum (32 GB recommandé)
- 100 GB espace disque

---

## 🚀 Installation rapide

```bash
# Cloner le dépôt
git clone https://github.com/your-org/mini-soc.git
cd mini-soc

# Copier les variables d'environnement
cp .env.example .env

# Générer les secrets
./scripts/generate-secrets.sh

# Générer les certificats TLS (développement)
./scripts/generate-certs.sh

# Démarrer tous les services
docker compose up -d

# Vérifier la santé
docker compose ps
```

Accéder au dashboard : https://localhost (admin@minisoc.local / changeme)

---

## 🏭 Déploiement Production

### Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Créer le namespace
kubectl create namespace minisoc

# Déployer avec Helm
helm install minisoc infrastructure/helm/mini-soc \
  --namespace minisoc \
  --values infrastructure/helm/mini-soc/values-production.yaml
```

### Ansible

```bash
ansible-playbook -i infrastructure/ansible/inventory/production.yml \
  infrastructure/ansible/playbooks/deploy.yml
```

---

## 📁 Structure du projet

```
mini-soc/
├── apps/
│   ├── frontend/          # React Dashboard SOC
│   └── backend/           # NestJS API
├── services/
│   ├── ml-engine/         # Machine Learning (anomaly detection)
│   ├── threat-intelligence/ # Threat Intel aggregator
│   └── plugin-engine/     # Plugin system
├── database/
│   ├── migrations/        # Prisma migrations
│   ├── seeds/             # Données initiales
│   └── backups/           # Scripts de backup
├── infrastructure/
│   ├── docker/            # Dockerfiles
│   ├── kubernetes/        # K8s manifests
│   ├── helm/              # Helm charts
│   ├── terraform/         # IaC cloud
│   ├── ansible/           # Configuration management
│   ├── nginx/             # Reverse proxy config
│   ├── vault/             # Secrets management
│   └── n8n/               # SOAR workflows
├── security/
│   ├── wazuh/             # SIEM/HIDS config
│   ├── falco/             # Runtime security
│   ├── suricata/          # Network IDS
│   ├── zeek/              # Network monitoring
│   └── yara/              # Malware detection rules
├── monitoring/
│   ├── prometheus/        # Metrics collection
│   ├── grafana/           # Dashboards
│   ├── alertmanager/      # Alert routing
│   └── loki/              # Log aggregation
├── docs/                  # Documentation complète
├── diagrams/              # Diagrammes d'architecture
├── scripts/               # Scripts utilitaires
├── tests/                 # Tests E2E, load, security
├── .github/               # GitHub Actions CI/CD
├── .gitlab/               # GitLab CI/CD
└── config/                # Configuration partagée
```

---

## 📚 Documentation

- [Guide d'installation](docs/installation.md)
- [Guide d'utilisation](docs/user-guide.md)
- [Architecture détaillée](docs/architecture.md)
- [API Reference (Swagger)](docs/api-reference.md)
- [Règles de détection](docs/detection-rules.md)
- [Playbooks SOAR](docs/soar-playbooks.md)
- [Procédure Incident Response](docs/incident-response.md)
- [Backup & Disaster Recovery](docs/backup-dr.md)
- [Contribution](CONTRIBUTING.md)

---

## 🤝 Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

---

## 📄 Licence

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE).

---

## 👤 Auteur

**Radwen CHEICHK** - Projet de Fin d'Études 2026

---

> ⚠️ Ce projet est conçu à des fins éducatives et de recherche. 
> Utilisez-le de manière responsable et éthique.
