# ── Build stage ──────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage ─────────────────────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
ENV YOUTRACK_URL=https://bitacora.youtrack.cloud
CMD ["nginx", "-g", "daemon off;"]
