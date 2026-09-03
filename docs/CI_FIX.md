# CI Fix — Mini-SOC Pipeline (radwen.yml)



## Contexte



Le pipeline CI (`.github/workflows/radwen.yml`) échouait sur plusieurs jobs avec

des erreurs `No such file or directory` et des `exit code 1/2`. Un patch

précédent (`mes_modifications.patch`) était incomplet : il **référençait** des

fichiers dans le workflow sans les **créer**, ce qui aggravait les échecs.



## Diagnostic



Cause racine : plusieurs fichiers sources exigés par le CI étaient absents du

dépôt. Leurs `.pyc` compilés subsistaient dans `__pycache__/`, ce qui prouve que

les sources `.py` avaient existé puis été perdues (jamais commitées ou

supprimées). En parallèle, deux fichiers d'observabilité existaient mais à un

chemin différent de celui attendu par le CI.



### État CI ↔ dépôt (avant correctif)



| Élément exigé par le CI | Job | État | Verdict |

|---|---|---|---|

| `services/ml-engine/training/generate_synthetic_data.py` | ml-validation | seul `.pyc` | Manquant |

| `services/ml-engine/training/train.py` | ml-validation | seul `.pyc` | Manquant |

| `services/ml-engine/training/evaluate.py` | ml-validation | seul `.pyc` | Manquant |

| `services/ml-engine/training/validate_model.py` | ml-validation | seul `.pyc` | Manquant |

| `security/mitre/generate-layer.py` | security-content-validation | seul `.pyc` | Manquant |

| `security/mitre/validate-layer.py` | security-content-validation | seul `.pyc` | Manquant |

| `infrastructure/monitoring/grafana/dashboards/soc-overview.json` | infra + platform | mauvais chemin (`provisioning/dashboards/`) | À déplacer/copier |

| `infrastructure/monitoring/prometheus/alerts/minisoc.yml` | platform-validation | mauvais chemin/nom (`prometheus/rules/soc-alerts.yml`) | À créer |

| `security/suricata/rules/custom-minisoc.rules` | security-content-validation | présent, 11 règles avec `sid:` | OK |

| `security/wazuh/rules/local_rules.xml` | security-content-validation | présent | OK |

| Métriques `minisoc_*` dans `apps/backend/src/metrics/metrics.service.ts` | platform-validation | présentes | OK |

| Job `minisoc-backend` dans `prometheus.yml` | platform-validation | présent | OK |

| `services/ml-engine/main.py`, `requirements.txt` | ml-validation | présents et compatibles | OK |



Note : l'`exit code 1` observé dans le job Suricata ne provenait pas des règles

Suricata (conformes) mais de l'étape MITRE suivante du même job, dont le script

était absent.



## Correctif



### Fichiers ajoutés



| Fichier | Rôle |

|---|---|

| `services/ml-engine/training/__init__.py` | Marque le package Python (vide). |

| `services/ml-engine/training/generate_synthetic_data.py` | Génère 2100 échantillons train + 550 test reproductibles (seed 42), anomalies réalistes. |

| `services/ml-engine/training/train.py` | Entraîne IsolationForest + StandardScaler, produit `models/anomaly_model.joblib`, `scaler.joblib`, `metadata.json`. |

| `services/ml-engine/training/evaluate.py` | Calcule precision/recall/F1/ROC-AUC + matrice de confusion, écrit `models/metrics.json`. |

| `services/ml-engine/training/validate_model.py` | Gate de non-régression vs `reference_metrics.json` (tolérance 5% sur F1 et ROC-AUC). |

| `services/ml-engine/data/.gitkeep` | Conserve le dossier `data/` (les datasets `.npz` sont ignorés). |

| `security/mitre/generate-layer.py` | Génère `attack-layer.json` et `techniques.json` depuis `diagrams/mitre-coverage.md` et les tags Sigma. |

| `security/mitre/validate-layer.py` | Valide la cohérence et le non-vide des fichiers MITRE générés. |

| `infrastructure/monitoring/grafana/dashboards/soc-overview.json` | Dashboard au chemin attendu par le CI (uid `soc-overview`, 12 panels, titres Alert/Incident/API). |

| `infrastructure/monitoring/prometheus/alerts/minisoc.yml` | Règles d'alerte Prometheus (5 règles) au chemin attendu par le CI. |

| `.github/workflows/ml-retraining.yml` | Réentraînement planifié (cron hebdo) + manuel, sans masquage d'erreur. |

### Fichiers modifiés



| Fichier | Modification |

|---|---|

| `.gitignore` | Ajout des artefacts générés (modèles ML, datasets, `metrics.json`, fichiers MITRE générés). |



### Fichiers générés par le CI (à ne pas committer)



- `services/ml-engine/models/*` (modèle, scaler, metadata, metrics)

- `services/ml-engine/data/*.npz`, `dataset_summary.json`

- `security/mitre/attack-layer.json`, `security/mitre/techniques.json`



## Principes respectés



- Aucun masquage d'erreur : pas de `|| true`, `continue-on-error`, `soft_fail`,

  ni assertion artificielle. Toute erreur fait échouer le job.

- Tests non truqués : les scripts produisent de vrais artefacts validés.

- `main.py` inchangé : déjà compatible (endpoints `/health` et `/detect-anomaly`,

  chargement de `models/anomaly_model.joblib` + `scaler.joblib`).



## Nettoyage Git recommandé



Les `.pyc` orphelins étaient déjà couverts par `.gitignore` (`__pycache__/`,

`*.pyc`) mais restaient suivis. Les retirer du suivi (non destructif) :



bash

git rm -r --cached services/ml-engine/training/__pycache__ security/mitre/__pycache__



## Comment tester



1. Déclencher isolément via `workflow_dispatch` les jobs sensibles :

   - `ml-validation`

   - `security-content-validation`

   - `platform-validation`

   - `infra-validation`

2. Vérifier localement (optionnel) la chaîne ML :

   bash

  python services/ml-engine/training/generate_synthetic_data.py

  python services/ml-engine/training/train.py

  python services/ml-engine/training/evaluate.py

  python services/ml-engine/training/validate_model.py

  

3. Lancer ensuite le pipeline complet.



## Note sur reference_metrics.json



validate_model.py crée reference_metrics.json

 au premier run s'il est absent

(pas de blocage à la première exécution). Pour figer une référence de


non-régression, committer le fichier avec les métriques de référence obtenues.