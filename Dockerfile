# ── Build stage — compile React frontend ─────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Production stage — Node.js server ────────────────────────────
FROM node:22-alpine
# Native modules (better-sqlite3, sqlite3) need build tools to compile
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false
# Clean up build tools to keep image small
RUN apk del python3 make g++
RUN mkdir -p /app/data

# Run as non-root user to limit container compromise blast radius
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
