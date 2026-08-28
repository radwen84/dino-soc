FROM falcosecurity/falco:0.38.1

COPY falco.yaml /etc/falco/falco.yaml
COPY falco_rules.local.yaml /etc/falco/falco_rules.local.yaml

VOLUME ["/var/log/falco"]

ENTRYPOINT ["/usr/bin/falco"]
# Ajout du paramètre engine.kind=modern_ebpf
CMD ["-o", "engine.kind=modern_ebpf", "-c", "/etc/falco/falco.yaml"]