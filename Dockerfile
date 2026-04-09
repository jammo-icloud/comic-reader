# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev && \
    apk del python3 make g++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./dist/client

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
