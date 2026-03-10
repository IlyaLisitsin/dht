FROM node:22-slim

RUN mkdir -p /data/jobs && chown -R node:node /data/jobs

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src/ src/

CMD ["node", "src/index.js"]
