FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
COPY bin ./bin
COPY src ./src
USER node
CMD ["node", "bin/server.js"]
