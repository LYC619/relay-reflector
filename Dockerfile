# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY package.json package-lock.json ./
RUN npm install
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json ./
COPY public/ public/
COPY src/ src/
RUN npm run build

# Stage 2: Build backend
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /frontend/dist /app/static

RUN mkdir -p /data

ENV UPSTREAM_URL=http://127.0.0.1:3000
ENV ADMIN_PASSWORD=relay123
ENV PORT=7891
ENV DB_PATH=/data/proxy.db
ENV RELAY_VERSION=1.0.0

EXPOSE 7891

CMD ["python", "main.py"]
