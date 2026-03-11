# Azure Pipelines self-hosted agent for Azure Container Apps
# Includes: Azure CLI, Node.js 20, git
# Uses --once mode: registers, runs one pipeline job, then exits (ACA restarts for next job)

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── Base tools ────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ca-certificates \
    gnupg \
    lsb-release \
    libicu70 \
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

# ── Azure Pipelines Agent ─────────────────────────────────────────────────────
WORKDIR /agent

RUN AGENT_VERSION=$(curl -fsSL https://api.github.com/repos/microsoft/azure-pipelines-agent/releases/latest \
        | jq -r '.tag_name' | sed 's/^v//') \
    && curl -fsSL \
        "https://vstsagentpackage.azureedge.net/agent/${AGENT_VERSION}/vsts-agent-linux-x64-${AGENT_VERSION}.tar.gz" \
        -o agent.tar.gz \
    && tar -xzf agent.tar.gz \
    && rm agent.tar.gz \
    && ./bin/installdependencies.sh

COPY agent-start.sh ./start.sh
RUN chmod +x ./start.sh

ENTRYPOINT ["/agent/start.sh"]
