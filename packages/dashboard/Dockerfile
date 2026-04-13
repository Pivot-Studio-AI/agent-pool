FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo tsconfig
COPY tsconfig.base.json ./tsconfig.base.json

# Install dashboard deps
COPY packages/dashboard/package*.json ./packages/dashboard/
RUN cd packages/dashboard && npm install

# Copy dashboard source
COPY packages/dashboard/ ./packages/dashboard/

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build with Vite only (skip tsc — checked separately)
RUN cd packages/dashboard && npx vite build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/dashboard/dist ./dist
COPY --from=builder /app/packages/dashboard/server.js ./server.js
EXPOSE 3001
CMD ["node", "server.js"]
