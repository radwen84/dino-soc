
FROM zeek/zeek:6.2

COPY local.zeek /opt/zeek/share/zeek/site/local.zeek
COPY scripts/ /opt/zeek/share/zeek/site/scripts/

VOLUME ["/var/log/zeek"]

ENTRYPOINT ["zeek"]
CMD ["-i", "eth0", "/opt/zeek/share/zeek/site/local.zeek"]