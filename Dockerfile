FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./api/
RUN cd api && npm install
COPY api/ ./api/
EXPOSE 3001
CMD ["node", "api/src/index.js"]
