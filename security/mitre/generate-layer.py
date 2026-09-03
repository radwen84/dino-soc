"""Generate a MITRE ATT&CK Navigator layer for the Mini-SOC coverage.



Reads technique IDs from diagrams/mitre-coverage.md and Sigma rule tags,

then writes security/mitre/attack-layer.json and security/mitre/techniques.json.

"""



import argparse

import glob

import json

import os

import re



TECHNIQUE_RE = re.compile(r"\bT\d{4}(?:\.\d{3})?\b")





def collect_from_coverage(base_dir: str) -> set:

    path = os.path.join(base_dir, "diagrams", "mitre-coverage.md")

    techniques = set()

    if os.path.exists(path):

        with open(path, encoding="utf-8") as f:

            techniques.update(TECHNIQUE_RE.findall(f.read()))

    return techniques





def collect_from_sigma(base_dir: str) -> set:

    techniques = set()

    pattern = os.path.join(base_dir, "security", "sigma", "rules", "*.yml")

    for p in glob.glob(pattern):

        with open(p, encoding="utf-8") as f:

            techniques.update(

                m.upper() for m in re.findall(r"attack\.(t\d{4}(?:\.\d{3})?)", f.read(), re.I)

            )

    return techniques





def main() -> None:

    parser = argparse.ArgumentParser()

    parser.add_argument("--base-dir", default=".")

    args = parser.parse_args()

    base_dir = os.path.abspath(args.base_dir)



    techniques = sorted(collect_from_coverage(base_dir) | collect_from_sigma(base_dir))

    if not techniques:

        raise SystemExit("No MITRE techniques found; cannot generate layer.")



    out_dir = os.path.join(base_dir, "security", "mitre")

    os.makedirs(out_dir, exist_ok=True)



    layer = {

        "name": "Mini-SOC Detection Coverage",

        "versions": {"attack": "14", "navigator": "4.9.1", "layer": "4.5"},

        "domain": "enterprise-attack",

        "description": "Auto-generated coverage layer for the Mini-SOC project.",

        "techniques": [

            {

                "techniqueID": t,

                "score": 100,

                "color": "#31a354",

                "enabled": True,

                "comment": "Detected by Mini-SOC",

            }

            for t in techniques

        ],

        "gradient": {"colors": ["#ffffff", "#31a354"], "minValue": 0, "maxValue": 100},

        "legendItems": [{"label": "Covered", "color": "#31a354"}],

    }



    with open(os.path.join(out_dir, "attack-layer.json"), "w", encoding="utf-8") as f:

        json.dump(layer, f, indent=2)



    with open(os.path.join(out_dir, "techniques.json"), "w", encoding="utf-8") as f:

        json.dump({"total": len(techniques), "techniques": techniques}, f, indent=2)



    print(f"Generated MITRE layer with {len(techniques)} techniques.")





if __name__ == "__main__":

    main()

