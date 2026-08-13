# Manuel d'installation de la stack Mini-SOC

Ce guide installe la stack Docker Compose définie dans `docker-compose.yml` à la racine du dépôt. Elle comprend Nginx et le dashboard React, NestJS, PostgreSQL, Redis, Wazuh, Filebeat, OpenSearch, Suricata, Zeek, Falco, Vault, n8n et les composants de monitoring.

> Les capteurs Suricata, Zeek et Falco observent l'hôte. Effectuez l'installation sur une machine de test ou un serveur Linux dédié, jamais sur un poste de production non prévu à cet effet.

## 1. Prérequis

| Élément | Minimum conseillé |
| --- | --- |
| Système | Linux récent (Ubuntu 22.04+ ou Debian 12+) |
| Docker Engine | 24+ |
| Docker Compose | plugin v2.20+ |
| Mémoire | 16 Go (32 Go recommandé) |
| Disque | 100 Go libres |
| CPU | 4 vCPU minimum |

Docker Desktop sous Windows/macOS peut servir pour construire l'application, mais il ne fournit pas la même visibilité réseau hôte pour Suricata et Zeek. Pour la stack complète, utilisez une VM Linux avec une interface réseau dédiée ou désactivez temporairement ces deux capteurs.

Sur Linux, configurez le prérequis OpenSearch :

```bash
sudo sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/99-minisoc.conf
sudo sysctl --system
```

Vérifiez ensuite l'installation Docker :

```bash
docker --version
docker compose version
docker info
```

## 2. Récupérer la branche de test

```bash
git clone https://github.com/radwen84/dino-soc.git
cd dino-soc
git switch test/devsecops-pipeline
```

Pour un dépôt déjà cloné :

```bash
git fetch origin
git switch test/devsecops-pipeline
git pull --ff-only
```

## 3. Préparer l'environnement

Copiez le modèle puis adaptez uniquement les variables non sensibles utiles au déploiement, notamment `API_CORS_ORIGINS`, `SURICATA_INTERFACE`, les services Threat Intel et les identifiants n8n/Grafana.

```bash
cp .env.example .env
chmod 600 .env
```

Ne placez pas les secrets Docker dans `.env`. Les fichiers du dossier `secrets/` sont exclus de Git et sont lus au démarrage par les conteneurs.

## 4. Créer les secrets

Sous Linux/macOS ou Git Bash/WSL :

```bash
chmod +x scripts/generate-secrets.sh scripts/generate-certs.sh
./scripts/generate-secrets.sh
```

Le script crée les secrets de base. Avant de démarrer la stack, renseignez **manuellement** `secrets/wazuh_api_password.txt` avec le mot de passe réel du compte configuré dans Wazuh pour `WAZUH_API_USER`. Ne copiez pas ce mot de passe dans `.env`, le README ou Git.

Vérifiez seulement la présence des fichiers, sans les afficher :

```bash
ls -l secrets/
test -s secrets/db_password.txt
test -s secrets/jwt_secret.txt
test -s secrets/jwt_refresh_secret.txt
test -s secrets/redis_password.txt
test -s secrets/wazuh_api_password.txt
```

Sous PowerShell, utilisez WSL ou Git Bash pour les scripts Bash. Ne convertissez pas les fichiers secrets en fichiers versionnés.

## 5. Configurer TLS et le nom local

Pour le développement, générez le certificat autosigné :

```bash
./scripts/generate-certs.sh
```

Ajoutez ensuite cette entrée dans le fichier `hosts` de la machine cliente :

```text
127.0.0.1 soc.local
```

Sur Linux, éditez `/etc/hosts`. Sur Windows, ouvrez en administrateur `C:\Windows\System32\drivers\etc\hosts`.

Le certificat de développement déclenchera un avertissement navigateur tant que l'autorité `infrastructure/nginx/ssl/ca.crt` n'est pas approuvée. En production, remplacez ces certificats par ceux d'une AC reconnue avant l'exposition réseau.

## 6. Choisir l'interface de capture

Relevez le nom de l'interface réseau qui doit être surveillée :

```bash
ip -br link
```

Dans `.env`, définissez par exemple :

```dotenv
SURICATA_INTERFACE=ens160
```

Suricata et Zeek utilisent le réseau hôte. Choisissez une interface de test ou un port miroir afin d'éviter toute capture non autorisée.

## 7. Valider la configuration avant démarrage

```bash
docker compose config -q
docker compose config --services
```

La liste doit contenir au minimum `nginx`, `nestjs-api`, `postgres`, `redis`, `wazuh-manager`, `opensearch`, `filebeat`, `suricata`, `zeek` et `falco`.

## 8. Construire et démarrer

Le premier démarrage télécharge plusieurs images et peut prendre plusieurs minutes.

```bash
docker compose build
docker compose up -d
docker compose ps
```

Suivez le démarrage des services critiques :

```bash
docker compose logs -f postgres redis opensearch wazuh-manager filebeat nestjs-api nginx
```

Pour arrêter le suivi, utilisez `Ctrl+C` : cela ne stoppe pas les conteneurs.

## 9. Vérifications après installation

### Services et API

```bash
docker compose ps
curl -k https://soc.local/health
curl -k https://soc.local/api/health
docker compose exec nestjs-api wget -qO- http://127.0.0.1:4000/api/health
```

Le dashboard est servi par le service `nginx` : il n'y a volontairement pas de service `frontend` séparé. L'image Nginx construit les assets React pendant le build Docker.

### Wazuh, Filebeat et OpenSearch

```bash
docker compose exec wazuh-manager test -f /var/ossec/logs/alerts/alerts.json
docker compose logs --tail=100 filebeat
docker compose exec opensearch curl -s http://localhost:9200/_cluster/health
docker compose exec opensearch curl -s http://localhost:9200/_cat/indices?v
```

Après la première alerte Wazuh, un index `wazuh-alerts-*` doit apparaître. OpenSearch n'est pas publié sur l'hôte : interrogez-le depuis son conteneur ou via l'API NestJS.

### Capteurs

```bash
docker compose exec suricata sh -c 'test -f /var/log/suricata/eve.json'
docker compose exec zeek sh -c 'test -d /var/log/zeek'
docker compose exec falco sh -c 'test -f /var/log/falco/events.json'
docker compose exec wazuh-manager ls -lah /var/log/suricata /var/log/zeek /var/log/falco
```

Le fichier Falco ou Zeek peut ne pas exister avant le premier événement. Consultez alors les journaux du capteur :

```bash
docker compose logs --tail=200 suricata zeek falco
```

## 10. Administration courante

```bash
# État et logs
docker compose ps
docker compose logs --tail=200 <service>

# Redémarrer un seul composant
docker compose restart <service>

# Mettre à jour les images et reconstruire
docker compose pull
docker compose build --pull
docker compose up -d

# Arrêt sans supprimer les données
docker compose down
```

N'utilisez `docker compose down -v` que si vous souhaitez supprimer volontairement les données PostgreSQL, OpenSearch, Wazuh et les autres volumes persistants.

## 11. Dépannage

| Symptôme | Contrôle | Action |
| --- | --- | --- |
| OpenSearch ne démarre pas | `docker compose logs opensearch` | Vérifier `vm.max_map_count`, mémoire disponible et espace disque. |
| Nginx ne démarre pas | `docker compose logs nginx` | Générer/installer `fullchain.pem` et `privkey.pem`. |
| API en état `unhealthy` | `docker compose logs nestjs-api` | Vérifier les secrets, PostgreSQL, Redis et le compte Wazuh. |
| Pas d'index Wazuh | `docker compose logs filebeat` | Vérifier `alerts.json` et le volume `wazuh_logs`. |
| Suricata/Zeek échouent | `docker compose logs suricata zeek` | Corriger `SURICATA_INTERFACE` et lancer sur Linux avec les capacités réseau requises. |
| Falco échoue | `docker compose logs falco` | Vérifier Docker socket, `/lib/modules` et la compatibilité noyau. |

## 12. Avant une exposition en production

- Remplacer le certificat autosigné par un certificat approuvé.
- Ne pas laisser de valeurs `CHANGE_ME` dans `.env`.
- Restreindre les ports Wazuh, Vault et les interfaces d'administration par pare-feu/VPN.
- Activer et configurer la sécurité native OpenSearch avec utilisateurs, TLS et certificats dédiés avant tout accès hors du réseau Docker.
- Sauvegarder les volumes et les secrets dans un coffre-fort approuvé.
- Tester un redémarrage et la chaîne d'alertes complète avant mise en service.
