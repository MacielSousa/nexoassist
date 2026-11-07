# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .

# ===== Dependências (só o workspace da API) =====
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root=false

# ===== Build (TypeScript → dist) =====
FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace apps/api

# ===== Produção =====
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# Aplica as migrations, popula o banco na primeira vez (o seed é idempotente) e sobe a API.
CMD ["sh", "-c", "npm run migration:run:prod && npm run seed:prod && npm start"]
