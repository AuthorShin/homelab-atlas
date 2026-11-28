FROM node:22.19.0-bookworm-slim AS node

FROM rust:1.85-bookworm AS img2svg
RUN cargo install img2svg --version 0.1.15 --locked

FROM debian:bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/AuthorShin/homelab-atlas" \
      org.opencontainers.image.title="Homelab Atlas vectorizer" \
      org.opencontainers.image.description="Raster-to-SVG tracing service for Homelab Atlas" \
      org.opencontainers.image.licenses="Apache-2.0"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp /app \
    && chmod 1777 /tmp \
    && chown -R 10001:10001 /app
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=img2svg /usr/local/cargo/bin/img2svg /usr/local/bin/img2svg
COPY vectorizer/server.mjs /app/server.mjs
WORKDIR /app
USER 10001:10001
ENV PORT=8081 NODE_ENV=production
EXPOSE 8081
CMD ["node", "server.mjs"]
