# ForgeRoom — Frontend-only Dockerfile
# Multi-stage: build with Node 20 LTS, serve with nginx:alpine
# No backend. Pure SPA — all logic runs in the browser.

# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first to exploit Docker layer caching.
# package-lock.json is included via the glob so npm install is
# deterministic when a lockfile is present.
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine AS serve

# Copy compiled SPA assets
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing: all paths fall back to index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
