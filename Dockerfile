# ---- Build stage: compile TypeScript to JavaScript ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --fetch-timeout=600000
COPY . .
RUN npm run build          # tsc: src/*.ts -> dist/*.js

# ---- Run stage: only what's needed to run the compiled app ----
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --fetch-timeout=600000  # production deps only — no typescript, vitest, etc.
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY public ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]