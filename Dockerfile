FROM ubuntu:22.04

# Avoid interaction during package install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wireguard-tools \
    strongswan \
    xl2tpd \
    iptables \
    iproute2 \
    curl \
    kmod \
    build-essential \
    python3 \
    libsqlite3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Build Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build

# 2. Setup Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --build-from-source

COPY backend ./backend

# 3. Setup Scripts
COPY scripts ./scripts
RUN chmod +x ./scripts/*.sh

# 4. Final Setup
RUN mkdir -p /data && chmod 777 /data
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001 51820/udp 500/udp 4500/udp 1701/udp

ENTRYPOINT ["/entrypoint.sh"]
