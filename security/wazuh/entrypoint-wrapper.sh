#!/bin/bash
set -e

# Démarrage en arrière-plan des services internes pour permettre la modification
/python/bin/python3 /var/ossec/framework/scripts/wazuh-keystore.py -s wazuh_api_password < /run/secrets/wazuh_api_password || true

# Execution du point d'entrée par défaut de Wazuh
exec /init