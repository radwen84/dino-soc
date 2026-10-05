FROM falcosecurity/falco:0.38.1

COPY falco.yaml /etc/falco/falco.yaml
COPY falco_rules.local.yaml /etc/falco/falco_rules.local.yaml

VOLUME ["/var/log/falco"]

# Utilisation directe du pilote modern_ebpf (sans compilation d'en-têtes)
ENTRYPOINT ["/usr/bin/falco", "-o", "engine.kind=modern_ebpf", "-c", "/etc/falco/falco.yaml"]
