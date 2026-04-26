FROM nginx:alpine

# Install envsubst and openssl
RUN apk add --no-cache gettext openssl

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl/live

# Generate a self-signed certificate for out-of-the-box HTTPS support
# Note: In production, users should replace these with real certificates (e.g. Let's Encrypt)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/live/dashboard.key \
    -out /etc/nginx/ssl/live/dashboard.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Copy template instead of static config
COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template

# Defaults
ENV BACKEND_HOST=127.0.0.1
ENV NGINX_PORT=8877

EXPOSE 80 443
