# ---- Build stage: toolchain, all dependencies, compile ----
FROM node:20-alpine AS build

# Needed only if a native module has no prebuilt binary for this platform.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop everything the running server doesn't load (Vite, TypeScript, React…),
# keeping any native modules that were compiled above.
RUN npm prune --omit=dev

# ---- Runtime stage: Node, production dependencies, built output ----
FROM node:20-alpine

# bsdtar (libarchive) extracts CBR archives for import.
RUN apk add --no-cache libarchive-tools

WORKDIR /app

# package.json is read at runtime for the version string.
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
