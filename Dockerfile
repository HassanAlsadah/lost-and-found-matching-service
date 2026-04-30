FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3004
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
