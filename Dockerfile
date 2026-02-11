# Production image: build client + run server in one container

# ---- client build ----
FROM node:20-alpine AS client_builder
WORKDIR /client
ARG VITE_BASE_PATH=/pokerklokke/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY client-react/package*.json ./
RUN npm ci
COPY client-react/ ./
RUN npm run build

# ---- server deps ----
FROM node:20-bullseye AS server_deps
WORKDIR /server
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:20-bullseye-slim AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3000

# server code + deps
COPY --from=server_deps /server/node_modules ./node_modules
COPY server/ ./

# client static files (served by Express)
COPY --from=client_builder /client/dist ./public

EXPOSE 3000
CMD ["node", "server.js"]
