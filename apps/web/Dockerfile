# Build a partir da raiz do monorepo: docker build -f apps/web/Dockerfile .

# ===== Dependências (só o workspace web) =====
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root=false

# ===== Build (Next.js standalone) =====
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# ===== Produção =====
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
