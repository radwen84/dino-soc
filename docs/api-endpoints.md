# API Endpoints

## Conventions générales
- Préfixe global NestJS : `api`
- Swagger disponible en développement : `api/docs`
- WebSocket namespace : `/ws`
- Le backend NestJS est l'API principale. Le service ML FastAPI est distinct et expose ses propres endpoints.

---

## Backend NestJS

### Auth
| Méthode | Route | Description |
|---|---|---|
| POST | `api/auth/login` | Authentification par email/mot de passe |
| POST | `api/auth/refresh` | Rafraîchir le token d'accès |
| POST | `api/auth/mfa/verify` | Vérifier le code MFA après login |
| POST | `api/auth/mfa/setup` | Générer QR code pour configurer MFA |
| POST | `api/auth/mfa/enable` | Activer MFA après validation TOTP |
| POST | `api/auth/mfa/disable` | Désactiver MFA (mot de passe requis) |
| GET | `api/auth/me` | Récupérer l'utilisateur connecté |

### Users
| Méthode | Route | Description |
|---|---|---|
| POST | `api/users` | Créer un utilisateur |
| GET | `api/users` | Lister les utilisateurs |
| GET | `api/users/:id` | Détails d'un utilisateur |
| PUT | `api/users/:id` | Mettre à jour un utilisateur |
| PATCH | `api/users/:id/deactivate` | Désactiver un utilisateur |

### Health
| Méthode | Route | Description |
|---|---|---|
| GET | `api/health` | Vérifie santé globale de l'API |
| GET | `api/health/ready` | Readiness check pour Kubernetes |
| GET | `api/health/live` | Liveness check pour Kubernetes |

### Metrics
| Méthode | Route | Description |
|---|---|---|
| GET | `api/metrics` | Expose metrics Prometheus |

### Alerts
| Méthode | Route | Description |
|---|---|---|
| GET | `api/alerts` | Liste les alertes avec filtres |
| GET | `api/alerts/critical` | Alertes critiques récentes |
| GET | `api/alerts/timeline` | Timeline des alertes (24h ou paramètre `hours`) |
| GET | `api/alerts/search` | Recherche d'alertes dans OpenSearch |
| GET | `api/alerts/:id` | Détail d'une alerte |
| PATCH | `api/alerts/:id/status` | Mise à jour du statut d'une alerte |
| PATCH | `api/alerts/bulk/status` | Mise à jour de statut en masse |
| PATCH | `api/alerts/bulk/link-incident` | Lier plusieurs alertes à un incident |

### Incidents
| Méthode | Route | Description |
|---|---|---|
| POST | `api/incidents` | Créer un incident |
| GET | `api/incidents` | Lister incidents avec filtres |
| GET | `api/incidents/statistics` | Statistiques pour le dashboard |
| GET | `api/incidents/:id` | Détails d'un incident |
| PATCH | `api/incidents/:id` | Mettre à jour un incident |
| PATCH | `api/incidents/:id/assign` | Assigner un incident à un analyste |
| PATCH | `api/incidents/:id/escalate` | Escalader un incident |
| PATCH | `api/incidents/:id/close` | Clôturer un incident |
| DELETE | `api/incidents/:id` | Suppression logique d'un incident |

### Assets
| Méthode | Route | Description |
|---|---|---|
| POST | `api/assets` | Créer un asset |
| GET | `api/assets` | Lister les assets |
| GET | `api/assets/stats` | Statistiques des assets |
| GET | `api/assets/search/ip/:ip` | Recherche par adresse IP |
| GET | `api/assets/search/hostname/:hostname` | Recherche par hostname |
| GET | `api/assets/:id` | Détails d'un asset |
| PUT | `api/assets/:id` | Mettre à jour un asset |
| DELETE | `api/assets/:id` | Supprimer un asset |
| POST | `api/assets/sync-wazuh` | Synchroniser manuellement avec Wazuh |

### IOC
| Méthode | Route | Description |
|---|---|---|
| POST | `api/ioc` | Créer un IOC |
| GET | `api/ioc` | Lister les IOC |
| GET | `api/ioc/stats` | Statistiques IOC |
| GET | `api/ioc/match/:value` | Matcher une valeur contre les IOC |
| GET | `api/ioc/:id` | Détails d'un IOC |
| PUT | `api/ioc/:id` | Mettre à jour un IOC |
| DELETE | `api/ioc/:id` | Supprimer un IOC |
| POST | `api/ioc/bulk-import` | Importer des IOC en masse |

### Threat Intelligence
| Méthode | Route | Description |
|---|---|---|
| GET | `api/threat-intel/lookup/:value` | Lookup TI pour IP/domaine/hash |
| GET | `api/threat-intel/feeds/status` | Statut des feeds TI |
| POST | `api/threat-intel/feeds/sync` | Synchroniser les feeds TI |

### Reports
| Méthode | Route | Description |
|---|---|---|
| GET | `api/reports/generate` | Générer un rapport |
| GET | `api/reports/types` | Lister les types de rapports |

### SOAR
| Méthode | Route | Description |
|---|---|---|
| GET | `api/soar/playbooks` | Lister les playbooks |
| GET | `api/soar/playbooks/defaults` | Templates de playbooks |
| GET | `api/soar/playbooks/:id` | Détail d'un playbook |
| POST | `api/soar/playbooks` | Créer un playbook |
| PATCH | `api/soar/playbooks/:id/toggle` | Activer/désactiver un playbook |
| POST | `api/soar/playbooks/:id/execute` | Exécuter manuellement un playbook |

---

## WebSocket temps réel
- Namespace : `/ws`
- Événements :
  - `new_alert`
  - `incident_created`
  - `incident_updated`
  - `stats_update`

---

## Service ML (FastAPI)
| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Vérifier que le service ML est opérationnel |
| POST | `/detect-anomaly` | Détecter une anomalie à partir de caractéristiques d'alerte |
| POST | `/risk-score` | Calculer un score de risque composite |
| POST | `/train` | Demander un réentraînement du modèle |

---

## Notes spécifiques
- Le backend principal est exposé sous `api` par NestJS.
- Le service ML est un service séparé, donc ses routes ne sont pas préfixées par `api`.
- Le fichier `apps/backend/src/users/users.controller.ts` semble contenir le code du service utilisateur plutôt qu'un contrôleur (`UsersService`). Il faut vérifier cette incohérence dans le module `UsersModule`.
- Swagger et la documentation API des routes NestJS sont générées automatiquement via `SwaggerModule` en dev.
