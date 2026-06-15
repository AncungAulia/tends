#!/bin/sh
set -e
# /root/.hermes is a persistent volume (keeps auth.json from the Copilot OAuth login).
# Re-seed config.yaml from the image on every start so config changes take effect,
# while the OAuth credential in the volume survives container recreates.
#
# Expand ${VARS} in config.yaml from the container environment: Hermes spawns the
# MCP server with ONLY the env declared under mcp_servers.*.env (it does NOT inherit
# the gateway's env), so DATABASE_URL + the chain config must be injected here or the
# MCP server exits with "Invalid environment variables" → "Connection closed".
# A line whose ${VAR} is unset is dropped (avoids passing empty/literal values).
mkdir -p /root/.hermes
python3 - <<'PY'
import os, re
out = []
for line in open("/opt/hermes/config.yaml").read().splitlines():
    m = re.search(r"\$\{(\w+)\}", line)
    if m:
        val = os.environ.get(m.group(1))
        if not val:
            continue
        line = line.replace("${%s}" % m.group(1), val)
    out.append(line)
open("/root/.hermes/config.yaml", "w").write("\n".join(out) + "\n")
PY
exec hermes gateway
