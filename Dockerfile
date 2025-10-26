FROM node:18-alpine AS frontend-builder

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:18-alpine

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/output

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]

