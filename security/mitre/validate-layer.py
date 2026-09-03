"""Validate the generated MITRE ATT&CK layer and techniques files."""



import json

import os

import re

import sys



MITRE_DIR = os.path.dirname(os.path.abspath(__file__))

TECHNIQUE_RE = re.compile(r"^T\d{4}(?:\.\d{3})?$")





def _load(name: str):

    path = os.path.join(MITRE_DIR, name)

    if not os.path.exists(path):

        print(f"ERROR: missing {path}", file=sys.stderr)

        sys.exit(1)

    with open(path, encoding="utf-8") as f:

        return json.load(f)





def main() -> None:

    layer = _load("attack-layer.json")

    techniques_doc = _load("techniques.json")



    layer_techs = [t.get("techniqueID") for t in layer.get("techniques", [])]

    if not layer_techs:

        print("ERROR: attack-layer.json has no techniques", file=sys.stderr)

        sys.exit(1)



    for t in layer_techs:

        if not t or not TECHNIQUE_RE.match(t):

            print(f"ERROR: invalid technique ID in layer: {t!r}", file=sys.stderr)

            sys.exit(1)



    total = techniques_doc.get("total", 0)

    techs = techniques_doc.get("techniques", [])

    if total <= 0 or total != len(techs):

        print(f"ERROR: techniques.json inconsistent (total={total}, list={len(techs)})",

              file=sys.stderr)

        sys.exit(1)



    if sorted(techs) != sorted(set(techs)):

        print("ERROR: duplicate techniques in techniques.json", file=sys.stderr)

        sys.exit(1)



    if set(layer_techs) != set(techs):

        print("ERROR: mismatch between layer and techniques.json", file=sys.stderr)

        sys.exit(1)



    print(f"MITRE layer valid: {total} techniques.")





if __name__ == "__main__":

    main()