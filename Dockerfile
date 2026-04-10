# Single stage — build and run in one image
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Clean up build tools
RUN apk del python3 make g++ && rm -rf /root/.npm /tmp/* src/

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
