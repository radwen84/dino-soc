# 🛠️ Guide de Développement

## Setup local

```bash
# Prérequis
node --version  # >= 20
docker --version  # >= 24

# Backend
cd apps/backend
npm install
cp ../../.env.example .env
# Lancer PostgreSQL + Redis
docker compose up -d postgres redis
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend (autre terminal)
cd apps/frontend
npm install
npm run dev
```

## Commandes utiles

```bash
# Backend
npm run start:dev       # Dev server (watch)
npm run test            # Tests unitaires
npm run test:e2e        # Tests E2E
npm run test:cov        # Couverture
npm run lint            # ESLint
npm run prisma:studio   # GUI base de données

# Frontend
npm run dev             # Vite dev server
npm run build           # Build production
npm run test            # Vitest
npm run lint            # ESLint
```

## Conventions

- **Branches** : `feature/`, `fix/`, `docs/`
- **Commits** : Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **Code** : TypeScript strict, ESLint + Prettier
- **Tests** : Minimum 80% couverture backend
- **PR** : Require 1 review, CI must pass

## Créer un nouveau module backend

```bash
# Exemple : créer un module "notifications"
nest generate module notifications
nest generate service notifications
nest generate controller notifications
# Puis ajouter les DTOs, tests, et l'enregistrer dans app.module.ts
```

## Structure des dossiers

```
apps/
├── backend/
│   ├── prisma/          # Schema + migrations + seed
│   ├── src/
│   │   ├── auth/        # Authentification
│   │   ├── users/       # Gestion utilisateurs
│   │   ├── incidents/   # Incidents
│   │   ├── alerts/      # Alertes
│   │   ├── ioc/         # IOC
│   │   ├── assets/      # Assets
│   │   ├── threat-intel/# Threat Intelligence
│   │   ├── reports/     # Rapports
│   │   ├── soar/        # SOAR Playbooks
│   │   ├── metrics/     # Prometheus
│   │   ├── common/      # Shared (guards, pipes, filters)
│   │   └── config/      # Configuration
│   └── test/            # Tests (unit, integration, e2e)
├── frontend/
│   ├── src/
│   │   ├── components/  # Composants React
│   │   ├── pages/       # Pages
│   │   ├── hooks/       # Custom hooks
│   │   ├── stores/      # Zustand stores
│   │   ├── lib/         # API client, socket
│   │   ├── layouts/     # Layouts
│   │   └── styles/      # CSS
│   └── nginx/           # Config Nginx
infrastructure/
├── docker-compose.prod.yml
├── kubernetes/          # Manifests K8s
├── terraform/           # IaC AWS
└── monitoring/          # Prometheus, Grafana, Loki
docs/                    # Documentation
scripts/                 # Scripts utilitaires
```
