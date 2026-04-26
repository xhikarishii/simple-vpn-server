FROM ubuntu:22.04

# Install dependencies
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

# Copy backend
COPY backend ./backend
WORKDIR /app/backend
RUN rm -rf node_modules && npm install --build-from-source

WORKDIR /app

# Copy scripts
COPY scripts ./scripts
RUN chmod +x ./scripts/*.sh

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001 51820/udp 500/udp 4500/udp 1701/udp

ENTRYPOINT ["/entrypoint.sh"]
