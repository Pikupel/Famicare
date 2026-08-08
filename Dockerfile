FROM node:22.13-alpine
WORKDIR /app
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev
COPY api/ ./api/
EXPOSE 3001
CMD ["node", "api/src/index.js"]
