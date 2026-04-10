# Build stage — compile TypeScript + build frontend
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage — use the same node_modules from the build
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy everything from builder: node_modules + built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./dist/client

# Clean up build tools
RUN apk del python3 make g++ && rm -rf /root/.npm /tmp/*

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
