#!/bin/bash
# Downloads, configures, and runs the Azure Pipelines agent once then exits.
# Downloading at startup (via ADO API) avoids build-time CDN/rate-limit issues.
# ACA Job scaler creates a fresh container for each queued pipeline job.
set -euo pipefail

: "${AZP_URL:?AZP_URL environment variable is required}"
: "${AZP_TOKEN:?AZP_TOKEN environment variable is required}"
: "${AZP_POOL:=Default}"
: "${AZP_AGENT_NAME:=aca-agent-$(hostname)}"

cleanup() {
  echo "Deregistering agent..."
  ./config.sh remove --unattended --auth pat --token "$AZP_TOKEN" 2>/dev/null || true
}

# ── Download agent (uses ADO REST API — always gets correct version + URL) ────
if [ ! -f "./config.sh" ]; then
  echo "Fetching agent package URL from ADO..."
  AZP_AGENT_PACKAGE_URL=$(curl -fsSL \
    -u "user:${AZP_TOKEN}" \
    "${AZP_URL}/_apis/distributedtask/packages/agent?platform=linux-x64&top=1" \
    | jq -r '.value[0].downloadUrl')

  if [ -z "$AZP_AGENT_PACKAGE_URL" ] || [ "$AZP_AGENT_PACKAGE_URL" = "null" ]; then
    echo "ERROR: Could not get agent download URL from ${AZP_URL}"
    exit 1
  fi

  echo "Downloading agent from: $AZP_AGENT_PACKAGE_URL"
  curl -fsSL "$AZP_AGENT_PACKAGE_URL" -o agent.tar.gz
  tar -xzf agent.tar.gz
  rm agent.tar.gz
  ./bin/installdependencies.sh
fi

# ── Configure and run ─────────────────────────────────────────────────────────
trap cleanup EXIT

echo "Configuring agent: $AZP_AGENT_NAME -> pool: $AZP_POOL"
./config.sh \
  --unattended \
  --url "$AZP_URL" \
  --auth pat \
  --token "$AZP_TOKEN" \
  --pool "$AZP_POOL" \
  --agent "$AZP_AGENT_NAME" \
  --replace \
  --acceptTeeEula

echo "Starting agent (--once: exits after completing one job)"
./run.sh --once
