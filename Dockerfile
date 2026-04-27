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
    ipset \
    dnsmasq \
    cron \
    curl \
    kmod \
    build-essential \
    python3 \
    libsqlite3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the solution
COPY . .

# Build frontend
RUN cd frontend && npm install --legacy-peer-deps && npm run build

# Build backend
RUN cd backend && npm install

# Configuration setup
RUN mkdir -p /etc/wireguard /etc/dnsmasq.d

# Generate self-signed certificate for dashboard HTTPS
RUN mkdir -p /etc/nginx/ssl/live && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/live/dashboard.key \
    -out /etc/nginx/ssl/live/dashboard.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Expose needed ports
# 3001: Backend API
# 51820: WireGuard UDP
# 500, 4500: IPsec UDP
# 1701: L2TP UDP
# 8877: Dashboard Redirect
# 443: Dashboard HTTPS
EXPOSE 3001 51820/udp 500/udp 4500/udp 1701/udp 8877 443

# Setup Cron & Scripts
COPY scripts/sync-blocklists.sh /usr/local/bin/sync-blocklists.sh
COPY scripts/backup-db.sh /usr/local/bin/backup-db.sh
RUN chmod +x /usr/local/bin/sync-blocklists.sh /usr/local/bin/backup-db.sh /app/scripts/*.sh /app/entrypoint.sh
RUN echo "0 */12 * * * root /usr/local/bin/sync-blocklists.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/blocklist-sync
RUN echo "0 3 * * * root /usr/local/bin/backup-db.sh >> /var/log/cron.log 2>&1" >> /etc/cron.d/blocklist-sync
RUN chmod 0644 /etc/cron.d/blocklist-sync

ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
