# Azure Pipelines self-hosted agent for Azure Container Apps
# Includes: Azure CLI, Node.js 20, git
# Agent binary is downloaded at startup via ADO API (avoids build-time CDN issues)
# Uses --once mode: registers, runs one pipeline job, then exits

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# ── System tools ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ca-certificates \
    gnupg \
    lsb-release \
    libssl3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ────────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Azure CLI ─────────────────────────────────────────────────────────────────
RUN curl -fsSL https://aka.ms/InstallAzureCLIDeb | bash \
    && rm -rf /var/lib/apt/lists/*

# ── Agent user (config.sh refuses to run as root) ────────────────────────────
RUN useradd -m -s /bin/bash agentuser

# ── Agent directory (populated at startup by agent-start.sh) ─────────────────
RUN mkdir -p /agent && chown agentuser:agentuser /agent
WORKDIR /agent

COPY agent-start.sh ./start.sh
# Strip Windows CRLF line endings and ensure executable
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh && chown agentuser:agentuser ./start.sh

USER agentuser

ENTRYPOINT ["/agent/start.sh"]
