# Stage 1: Build the frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

# Stage 2: Production runtime environment
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/models.js ./models.js
COPY --from=builder /app/routes.js ./routes.js
COPY --from=builder /app/services.js ./services.js

# Ensure local uploads directory structure exists
RUN mkdir -p uploads/temp uploads/templates

EXPOSE 5000
CMD ["node", "server.js"]
