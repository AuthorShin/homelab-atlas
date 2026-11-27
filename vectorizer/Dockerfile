FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY vectorizer/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM ubuntu:24.04
LABEL org.opencontainers.image.source="https://github.com/AuthorShin/homelab-atlas" \
      org.opencontainers.image.title="Homelab Atlas vectorizer" \
      org.opencontainers.image.description="Raster-to-SVG tracing service for Homelab Atlas" \
      org.opencontainers.image.licenses="MIT"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp /app \
    && chmod 1777 /tmp \
    && chown -R 10001:10001 /app
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY vectorizer/server.mjs /app/server.mjs
WORKDIR /app
USER 10001:10001
ENV PORT=8081 NODE_ENV=production
EXPOSE 8081
CMD ["node", "server.mjs"]
