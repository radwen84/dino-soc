# 🚀 Guide de Déploiement

## Prérequis

- Docker >= 24.0
- Docker Compose >= 2.20
- Node.js >= 20 (pour le développement)
- kubectl (pour Kubernetes)
- Terraform >= 1.5 (pour le cloud)

## Déploiement Local (Docker Compose)

```bash
# 1. Cloner le repo
git clone https://github.com/loulou/mini-soc.git
cd mini-soc

# 2. Générer les secrets
./scripts/generate-secrets.sh

# 3. Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Lancer la stack
docker compose -f infrastructure/docker-compose.prod.yml up -d

# 5. Appliquer les migrations
docker exec minisoc-backend npx prisma migrate deploy

# 6. Seed la base de données
docker exec minisoc-backend npx prisma db seed

# 7. Accéder au dashboard
open http://localhost
# Login: admin@minisoc.local / Admin@MiniSOC2026!
```

## Déploiement Kubernetes

```bash
# 1. Provisioner l'infrastructure (AWS)
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# 2. Configurer kubectl
aws eks update-kubeconfig --name minisoc-cluster --region eu-west-3

# 3. Déployer les manifests
kubectl apply -f infrastructure/kubernetes/namespace.yaml
kubectl apply -f infrastructure/kubernetes/secrets.yaml
kubectl apply -f infrastructure/kubernetes/network-policies.yaml
kubectl apply -f infrastructure/kubernetes/backend-deployment.yaml
kubectl apply -f infrastructure/kubernetes/frontend-deployment.yaml
kubectl apply -f infrastructure/kubernetes/ingress.yaml

# 4. Vérifier
kubectl -n minisoc get pods
kubectl -n minisoc get svc
```

## Monitoring

```bash
# Lancer la stack monitoring
docker compose -f infrastructure/monitoring/docker-compose.monitoring.yml up -d

# Accès:
# Grafana: http://localhost:3001 (admin / MiniSOC@Grafana2026)
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
```

## Variables d'Environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| DATABASE_URL | PostgreSQL connection string | - |
| JWT_SECRET | JWT signing key (min 32 chars) | - |
| JWT_EXPIRES_IN | Access token TTL | 15m |
| JWT_REFRESH_EXPIRES_IN | Refresh token TTL | 7d |
| REDIS_URL | Redis connection | redis://localhost:6379 |
| OPENSEARCH_NODE | OpenSearch URL | https://localhost:9200 |
| CORS_ORIGINS | Allowed origins (comma-sep) | http://localhost:3000 |
| OTX_API_KEY | AlienVault OTX API key | - |
| ABUSEIPDB_API_KEY | AbuseIPDB API key | - |
| MISP_URL | MISP instance URL | - |
| MISP_API_KEY | MISP API key | - |

