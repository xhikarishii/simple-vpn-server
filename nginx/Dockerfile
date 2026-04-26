FROM nginx:stable-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8877
CMD ["nginx", "-g", "daemon off;"]
