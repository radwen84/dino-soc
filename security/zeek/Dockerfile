FROM zeek/zeek:6.2

# Définir le PATH pour accéder directement aux binaires zeek
ENV PATH="/usr/local/zeek/bin:/opt/zeek/bin:${PATH}"

# Copier les scripts aux bons emplacements de l'image officielle 6.2
COPY local.zeek /usr/local/zeek/share/zeek/site/local.zeek
COPY scripts/ /usr/local/zeek/share/zeek/site/scripts/

VOLUME ["/var/log/zeek"]

# Utiliser le chemin absolu vers l'exécutable Zeek
ENTRYPOINT ["/usr/local/zeek/bin/zeek"]
CMD ["-i", "eth0", "/usr/local/zeek/share/zeek/site/local.zeek"]