# Import Orchestrator — handles folder scanning + MAL enrichment
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SERVER_PORT=3001
ENV DATA_DIR=/app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]
