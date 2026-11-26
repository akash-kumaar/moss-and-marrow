# Stage 1: Build the React application with Vite
FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies deterministically
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Build argument for API URL if custom endpoint is required (defaults to same-origin /api/v1)
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

# Build production assets into dist/
RUN npm run build

# Stage 2: Serve the production bundle with Nginx Alpine
FROM nginx:1.27-alpine

# Patch underlying Alpine OS packages against known CVEs
RUN apk update && apk upgrade --no-cache

# Remove default nginx configuration and static site
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/nginx/moss-tls /etc/nginx/snippets /var/www/acme \
    && touch /etc/nginx/moss-tls/https-server.conf /etc/nginx/moss-tls/https-redirect.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-routes.conf /etc/nginx/snippets/moss-routes.conf

# Copy built application from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

