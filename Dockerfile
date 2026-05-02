FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
COPY start.sh ./
RUN chmod +x start.sh
EXPOSE 3004
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
ENV NODE_ENV=production
CMD ["sh", "start.sh"]
