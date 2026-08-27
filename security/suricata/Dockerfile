FROM jasonish/suricata:7.0.5

COPY suricata.yaml /etc/suricata/suricata.yaml
COPY rules/custom-minisoc.rules /etc/suricata/rules/custom-minisoc.rules

# Download ET Open ruleset
RUN suricata-update enable-source et/open && \
    (suricata-update || true)

VOLUME ["/var/log/suricata"]

ENTRYPOINT ["suricata"]
CMD ["-c", "/etc/suricata/suricata.yaml", "--af-packet", "-D"]
