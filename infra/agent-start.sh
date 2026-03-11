#!/bin/bash
# Configures and runs the Azure Pipelines agent once, then exits.
# ACA Job scaler will create a new container for the next queued job.
set -euo pipefail

: "${AZP_URL:?AZP_URL environment variable is required}"
: "${AZP_TOKEN:?AZP_TOKEN environment variable is required}"
: "${AZP_POOL:=Default}"
: "${AZP_AGENT_NAME:=aca-agent-$(hostname)}"

cleanup() {
  echo "Deregistering agent..."
  ./config.sh remove --unattended --auth pat --token "$AZP_TOKEN" || true
}
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
