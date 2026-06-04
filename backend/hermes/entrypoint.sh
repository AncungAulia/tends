#!/bin/sh
set -e
# /root/.hermes is a persistent volume (keeps auth.json from the Copilot OAuth login).
# Refresh config.yaml from the image on every start so config changes take effect,
# while the OAuth credential in the volume survives container recreates.
mkdir -p /root/.hermes
cp /opt/hermes/config.yaml /root/.hermes/config.yaml
exec hermes gateway
