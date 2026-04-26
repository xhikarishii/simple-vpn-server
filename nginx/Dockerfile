FROM nginx:alpine

# Install envsubst
RUN apk add --no-cache gettext

# Copy template instead of static config
COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template

# Defaults
ENV BACKEND_HOST=127.0.0.1
ENV NGINX_PORT=8877

# The official Nginx image automatically runs envsubst on files in /etc/nginx/templates/*.template
# and puts the result in /etc/nginx/conf.d/default.conf
