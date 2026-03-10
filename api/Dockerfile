FROM node:22-slim

RUN mkdir -p /data/jobs /tmp/uploads && chown -R node:node /data/jobs /tmp/uploads

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src/ src/

USER node
CMD ["node", "src/index.js"]
