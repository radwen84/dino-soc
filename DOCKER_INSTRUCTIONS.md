# Instructions Docker — après déploiement du code de la branche fix/production-readiness

## 1. Appliquer la migration Prisma

```bash
docker exec -it minisoc-api npx prisma migrate deploy
```

Cela ajoutera le champ `wazuh_alert_id` et l'index sur `agent_id` à la table `alerts`.

## 2. Régénérer le client Prisma (si pas fait au build)

```bash
docker exec -it minisoc-api npx prisma generate
```

## 3. Redémarrer le backend pour activer le cron de sync

```bash
docker compose restart backend
```

## 4. Tester la sync manuelle

```bash
# Obtenir un token admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@minisoc.local","password":"<MOT_DE_PASSE>"}' \
  | jq -r '.accessToken')

# Déclencher la sync
curl -X POST http://localhost:3000/api/alerts/sync-wazuh \
  -H "Authorization: Bearer $TOKEN"

# Vérifier les alertes en base
docker exec -it minisoc-postgres psql -U minisoc -d minisoc -c "SELECT COUNT(*) FROM alerts WHERE wazuh_alert_id IS NOT NULL;"

# Vérifier l'API
curl -s http://localhost:3000/api/alerts -H "Authorization: Bearer $TOKEN" | jq '.meta.total'
```

## 5. Vérifier la pipeline Wazuh → OpenSearch

```bash
# Vérifier que Wazuh écrit les alertes JSON
docker exec -it minisoc-wazuh-manager ls -la /var/ossec/logs/alerts/alerts.json

# Vérifier que Filebeat lit et pousse vers OpenSearch
docker logs minisoc-filebeat --tail 20

# Vérifier que les alertes sont dans OpenSearch
curl -s http://localhost:9200/wazuh-alerts-*/_count | jq '.count'
```

## 6. Vérifier le WebSocket (dans la console navigateur)

```javascript
const socket = io('ws://localhost:3000/ws', { auth: { token: '<TOKEN>' }, transports: ['websocket'] });
socket.on('alert:new', (data) => console.log('New alert:', data));
socket.on('stats:update', (data) => console.log('Stats:', data));
```

## 7. Phase 2 — Vérifier Redis pour la sécurité auth

```bash
# Vérifier que Redis tourne
docker exec -it minisoc-redis redis-cli PING
# Doit répondre PONG

# Après un logout, vérifier que le refresh token est supprimé
docker exec -it minisoc-redis redis-cli KEYS "refresh:*"
```

## 8. Seed de la base (après fix Phase 3bis)

```bash
docker exec -it minisoc-api npx prisma db seed
# Doit passer sans erreur, même exécuté 2 fois de suite
```
