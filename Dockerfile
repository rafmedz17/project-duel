FROM node:24-bookworm-slim AS client-build
WORKDIR /app
COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY shared ./shared
COPY client ./client
COPY scripts/compress-client.mjs ./scripts/compress-client.mjs
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm --prefix client run build && node scripts/compress-client.mjs

FROM node:24-bookworm-slim AS server-dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=2567 CLIENT_DIRECTORY=/app/client/dist RESULTS_DIRECTORY=/data/results
WORKDIR /app/server
COPY --from=server-dependencies /app/server/node_modules ./node_modules
COPY server/package.json ./package.json
COPY server/src ./src
COPY shared /app/shared
COPY --from=client-build /app/client/dist /app/client/dist
RUN mkdir -p /data/results
EXPOSE 2567
CMD ["node", "src/index.js"]
