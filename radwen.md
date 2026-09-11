# Cartographie réelle des interactions Mini-SOC

Analyse statique des sources `apps/backend/src` et `apps/frontend/src`.
Les routes NestJS sont préfixées par `/api` dans `main.ts`.

## Architecture

```text
Pages React -> Axios (/api) -> Controllers NestJS -> services métier
     ^                                      |          |-> Prisma/PostgreSQL
     |                                      |          |-> Redis/OpenSearch
Socket.IO (/ws) <- AlertsGateway <- EventEmitter2      |-> Wazuh/TheHive/ML/feeds TI
```

`AppModule` importe Auth, Users, Audit, Health, Incidents, Alerts, IOC,
Assets, Threat Intel, Reports, SOAR, OpenSearch, Wazuh et WebSocket. Prisma,
Redis, OpenSearch et Audit sont globaux. `MetricsModule` existe mais n'est pas
importé dans `AppModule`: son contrôleur n'est donc pas monté actuellement.

## Socle frontend

| Source | Interactions réelles |
|---|---|
| `main.tsx` | Monte `QueryClientProvider`, `BrowserRouter`, toasts et Devtools. React Query: cache frais 30 s, 2 retries, pas de refetch au focus. |
| `App.tsx` | Routes: `/login`, puis `/`, `/incidents`, `/incidents/:id`, `/alerts`, `/ioc`, `/assets`, `/threat-intel`, `/reports`, `/users`, `/settings`. `ProtectedRoute` lit Zustand et redirige sinon vers `/login`. |
| `lib/api.ts` | Axios utilise `baseURL: /api`, ajoute le bearer token, puis sur un 401 non-auth appelle `/auth/refresh`, met à jour les tokens et rejoue la requête; sinon logout + redirection. |
| `stores/auth.store.ts` | Stocke user/tokens/isAuthenticated. Seuls user et isAuthenticated sont persistés sous `minisoc-auth`; les tokens restent en mémoire. |
| `hooks/useAuth.ts` | Login: `/auth/login`; MFA: `/auth/mfa/verify` avec `tempToken`/`totpToken`; succès: `setAuth`, toast, `navigate('/')`. Logout: nettoie le store et `navigate('/login')`. |
| `lib/socket.ts`, `useWebSocket.ts` | Ouvre `/ws` avec le JWT; reçoit alertes/incidents, affiche notifications et invalide les caches React Query. |

## Auth, MFA et utilisateurs

```text
LoginPage -> useLogin -> POST /auth/login -> AuthService.validateUser
  -> UsersService.findByEmail + bcrypt + AuditService
  -> requiresMfa ? LoginPage MFA -> POST /auth/mfa/verify
  -> TotpService + Redis anti-rejeu + UsersService -> JWT access/refresh
  -> Zustand -> routes protégées, Axios et Socket.IO
```

| Route | Appels backend |
|---|---|
| `POST /auth/login` | `validateUser` puis `login`; comptes d'échecs/verrouillage via UsersService, audit, JWT. |
| `POST /auth/mfa/verify` | `verifyMfa` vérifie JWT temporaire, TOTP et clé Redis `totp:used:<user>:<code>`, puis produit les tokens finaux. |
| `POST /auth/refresh`, `/logout` | Rotation/révocation du refresh token dans Redis. |
| `POST /auth/mfa/setup`, `/enable`, `/disable` | TotpService + UsersService. |
| `GET /auth/me` | Retourne le payload JWT. |
| `/users` CRUD | UsersController -> UsersService -> Prisma: création, pagination, lecture, update, désactivation. |

Le backend expose le setup MFA, mais `SettingsPage` ne consomme aucune API:
QR, mot de passe et sessions sont actuellement des états UI/toasts locaux.

## Incidents

| Frontend/API | Chaîne réelle |
|---|---|
| `IncidentsPage`: `GET/POST /incidents` | IncidentsController -> IncidentsService -> Prisma + AuditService. La création émet `incident.created`, appelle ML Engine et tente `TheHiveService.pushIncident`. |
| `IncidentDetailPage`: `GET /incidents/:id`, `PATCH /incidents/:id` | Lecture/update Prisma; changement de statut émet `incident.status_changed`. |
| API additionnelle | assignation, escalade, clôture et suppression logique: `PATCH /incidents/:id/assign`, `/escalate`, `/close`, `DELETE /:id`; statistiques via `GET /incidents/statistics`. |
| Temps réel | Gateway relaie `incident.created` en `incident:created` et `incident.status_changed` en `incident:updated`; le hook invalide les queries incidents. |

## Alertes

| Frontend/API | Chaîne réelle |
|---|---|
| `AlertsPage`, `RecentAlerts`: `GET /alerts`, `PATCH /alerts/:id/status` | AlertsController -> AlertsService -> Prisma. La mise à jour peut lier/créer un incident. |
| Dashboard: `GET /alerts/timeline` | `AlertsService.getAlertTimeline`. |
| API additionnelle | `/critical`, `/search`, `/:id`, `POST /sync-wazuh`, opérations bulk status/link-incident. Recherche via OpenSearch. |
| Cron (5 min) | `syncFromOpenSearch` lit OpenSearch, upsert Prisma, émet `alert.new`. |
| Temps réel | Gateway publie `alert:new`; frontend notifie, toast critique et invalide alerts/dashboard. |

## IOC et assets

| Module | Frontend/API | Dépendances et effets |
|---|---|---|
| IOC | `IocPage`: `GET/POST /ioc`; dashboard: `/ioc/stats`; API: CRUD, `/match/:value`, `/bulk-import` | Prisma + AuditService + index/recherche OpenSearch + événement `ioc.created`. Cron horaire: expiration des IOC. |
| Assets | `AssetsPage`: `GET/POST /assets`; dashboard: `/assets/stats`; API: CRUD, recherches IP/hostname, `/sync-wazuh` | Prisma + AuditService. Cron toutes les 6 h: `WazuhService.getAgents` puis synchronisation. |

## Threat Intelligence

| Frontend/API | Chaîne réelle |
|---|---|
| `ThreatIntelPage`: `GET /threat-intel/feeds/status` | `ThreatIntelService.getFeedStatus`. |
| `GET /threat-intel/lookup/:value` | Recherche IOC locale puis enrichissements MISP, AbuseIPDB, OTX et STIX/TAXII lorsqu'ils sont configurés. |
| `POST /threat-intel/feeds/sync` | Synchronise OTX/MISP et importe les IOC. Cron toutes les 4 h. |
| API non utilisée par la page | `/taxii/ingest`, `/taxii/collections`, `/stix/export`: StixTaxiiService + `IocService.bulkImport` ou bundle STIX. |

Les clients externes utilisent `HttpService`: AbuseIPDB, OTX, MISP, TAXII,
TheHive, ML Engine et Wazuh. Leurs erreurs peuvent être non bloquantes selon le
service appelant.

## Rapports et dashboard

| Frontend/API | Chaîne réelle |
|---|---|
| `ReportsPage`: `GET /reports/generate` | ReportsController -> ReportsService -> Prisma + AuditService. Types: résumé exécutif, incident, paysage de menaces, KPI, conformité, inventaire. JSON utilisé par l'UI; CSV produit par le contrôleur; PDF est actuellement un JSON annoté. |
| Dashboard et composants graphiques | Appels `/incidents?limit=1`, `/alerts?limit=1`, `/ioc/stats`, `/assets/stats` et `/reports/generate`; il n'existe pas de BFF dashboard. |
| `GET /reports/types` | API disponible, mais aucun consommateur frontend trouvé. |

## SOAR

Le frontend ne comporte pas de page SOAR, mais l'API expose playbooks,
approbations, création, bascule et exécution manuelle sous `/soar`.

`SoarService` persiste/audite et délègue à `PlaybookEngine`. Celui-ci écoute
`alert.new` et `incident.created`, sélectionne les playbooks, exécute avec
timeout/retry et conserve approbations/exécutions dans Redis.

| Action | Appel réel |
|---|---|
| Enrichir/lookup | ThreatIntelService `enrichAlert` ou `lookup`. |
| Bloquer IP/isoler hôte | WazuhService `blockIP` ou `triggerActiveResponse`. |
| IOC/asset | IocService et AssetsService. |
| Approbation/exécution | Redis et événements `soar.approval_*`, `soar.execution_complete`, `soar.action.*`, `notification.send`. |

## Événements et WebSocket

| Producteur | Événement Nest | Consommateurs | Socket client |
|---|---|---|---|
| AlertsService | `alert.new` | AlertsGateway, PlaybookEngine | `alert:new` |
| IncidentsService | `incident.created` | AlertsGateway, PlaybookEngine | `incident:created` |
| IncidentsService | `incident.status_changed` | AlertsGateway | `incident:updated` |
| AlertsGateway (10 s, clients connectés) | direct | clients Socket.IO | `stats:update` |

La gateway valide le JWT dans le handshake (`issuer: minisoc`,
`audience: minisoc-api`); elle émet `auth_error` et déconnecte sinon.
`useWebSocket` ne consomme pas encore `stats:update` ni les événements SOAR.

## Infrastructure et écarts de branchement

- `PrismaService`: PostgreSQL, utilisé par tous les domaines métier et l'audit.
- `RedisService`: refresh tokens, anti-rejeu MFA, approbations/exécutions SOAR.
- `OpenSearchService`: synchronisation/recherche alertes, indexation IOC.
- `WazuhService`: inventaire assets et actions actives SOAR.
- `HealthController`: `/health`, `/ready`, `/live`, vérifie Prisma/Redis.
- Prometheus expose `/api/metrics` via `PrometheusModule`; `MetricsService` n'est
  pas monté car `MetricsModule` n'est pas importé.
- Aucun relai WebSocket ou listener de frontend n'existe encore pour les
  événements `soar.*`; les endpoints SOAR/TAXII et plusieurs endpoints CRUD
  backend ne sont pas encore consommés par `apps/frontend/src`.
