# Node Alpine -- multi-arch (amd64 + arm64)
FROM oven/bun:1.3.11-alpine AS builder

WORKDIR /app

# Install system dependencies required for Bun
RUN apk add --no-cache wget curl bash

# Copy package files first for caching (bun.lock is the lockfile used by this project)
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the project
COPY . .

# Build the static site (plain vite build — skips the bundle-visualizer/postbuild steps)
RUN bunx vite build

# Serve with nginx
FROM nginx:1.28.2-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Inject the Flacdium backend origin at container start from $FLACDIUM_BASE.
COPY docker-flacdium-config.sh /docker-entrypoint.d/40-flacdium-config.sh
RUN chmod +x /docker-entrypoint.d/40-flacdium-config.sh

# Expose the nginx port
EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
