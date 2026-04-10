# OCR Service — tesseract + mupdf + Ollama client
FROM node:20-alpine

# tesseract.js downloads its own WASM worker, no system package needed
# But if we want system tesseract for speed:
# RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SERVER_PORT=3001
ENV DATA_DIR=/app/data
ENV OLLAMA_URL=http://ollama:11434
ENV OLLAMA_MODEL=llama3.2:3b

EXPOSE 3001

CMD ["node", "dist/index.js"]
