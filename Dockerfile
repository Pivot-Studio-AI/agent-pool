FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/daemon/package.json packages/daemon/
RUN npm ci

# Build dashboard
COPY packages/dashboard/ packages/dashboard/
RUN npm run build -w packages/dashboard

# Build server
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./

# Production stage
FROM node:20-alpine
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/server ./packages/server
COPY --from=base /app/packages/dashboard/dist ./packages/dashboard/dist
COPY --from=base /app/package.json ./

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npx", "tsx", "packages/server/src/index.ts"]
