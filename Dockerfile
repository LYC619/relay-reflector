FROM python:3.11-slim AS frontend-builder

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /frontend
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json ./
COPY public/ public/
COPY src/ src/
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /frontend/dist /app/static

RUN mkdir -p /data

ENV UPSTREAM_URL=http://127.0.0.1:3000
ENV ADMIN_PASSWORD=admin123
ENV PORT=7891
ENV DB_PATH=/data/proxy.db

EXPOSE 7891

CMD ["python", "main.py"]
