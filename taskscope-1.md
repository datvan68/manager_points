# Quy Trinh Trien Khai Production Bang Docker

## Muc Tieu

Trien khai du an Manager Point len moi truong production bang Docker theo huong de cap nhat ma nguon, giam thoi gian downtime, va tranh cac loi bao mat pho bien.

Runbook nay tap trung cho production. File `docker-compose.yml` o thu muc goc nen duoc xem la file dung cho development vi hien dang bind mount source code vao container, expose truc tiep MongoDB/Redis ra host, va dung cac image tag de thay doi nhu `latest`.

## Hien Trang Du An

- `backend`: NestJS API, lang nghe port `8000`, dung `MONGO_URI`, `JWT_SECRET`, cac bien SMTP, va expose Prometheus metrics tai `/metrics`.
- `frontend`: Next.js app voi `output: "standalone"`, lang nghe port `3000`, dung `NEXT_PUBLIC_API_URL`.
- `mongodb`: co so du lieu chinh, can volume de luu tru ben vung.
- `redis`: dich vu cache/queue dang co trong compose.
- `prometheus` va `grafana`: dich vu quan sat he thong.

## Chien Luoc Production

Dung application image bat bien va tach rieng file compose cho production:

1. Build Docker image tu source code.
2. Gan tag image bang Git commit SHA hoac release version.
3. Push image len registry.
4. Tren server, pull dung version da duyet va restart chi nhung service thay doi.
5. Luu du lieu database trong Docker volume.
6. Luu secrets trong file moi truong tren server hoac secret manager, khong commit vao Git.

Ten image khuyen nghi:

```text
registry.example.com/manager-point/backend:<git-sha>
registry.example.com/manager-point/frontend:<git-sha>
```

## Cac File Production Can Co

Tao cac file sau truoc lan deploy production dau tien:

```text
docker-compose.prod.yml
infra/caddy/Caddyfile
infra/prometheus.prod.yml
```

File sau chi duoc luu tren production server va khong commit vao Git:

```text
.env.production
```

## Bien Moi Truong

File `.env.production` tren server nen co cac key nhu sau, gia tri that se duoc dien tren server:

```dotenv
APP_VERSION=<git-sha-or-release-tag>
REGISTRY=registry.example.com/manager-point

NODE_ENV=production
PORT=8000
FRONTEND_URL=https://manager-point.example.com
NEXT_PUBLIC_API_URL=https://manager-point.example.com/api

MONGO_INITDB_ROOT_USERNAME=<strong-admin-user>
MONGO_INITDB_ROOT_PASSWORD=<strong-admin-password>
MONGO_DATABASE=manager-point
MONGO_URI=mongodb://<app-user>:<strong-app-password>@mongodb:27017/manager-point?authSource=manager-point

REDIS_PASSWORD=<strong-redis-password>
REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=<long-random-secret>

MAIL_HOST=<smtp-host>
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<smtp-user>
MAIL_PASS=<smtp-password>
MAIL_FROM=<sender-address>

GRAFANA_ADMIN_USER=<admin-user>
GRAFANA_ADMIN_PASSWORD=<strong-admin-password>
```

Quy tac bao mat:

- Khong commit `.env.production`.
- Khong in secrets ra log CI.
- Xoay vong `JWT_SECRET`, thong tin SMTP, mat khau database, va registry token theo lich dinh ky.
- Uu tien dung cloud secret manager hoac Docker secrets neu ha tang ho tro.

## File `docker-compose.prod.yml` Khuyen Nghi

```yaml
services:
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - frontend
      - backend
    networks:
      - public
      - internal

  frontend:
    image: ${REGISTRY}/frontend:${APP_VERSION}
    restart: unless-stopped
    env_file:
      - ./.env.production
    expose:
      - "3000"
    depends_on:
      - backend
    networks:
      - internal
    security_opt:
      - no-new-privileges:true

  backend:
    image: ${REGISTRY}/backend:${APP_VERSION}
    restart: unless-stopped
    env_file:
      - ./.env.production
    expose:
      - "8000"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - internal
    security_opt:
      - no-new-privileges:true

  mongodb:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_DATABASE}
    volumes:
      - mongo-data:/data/db
      - ./infra/mongo/init:/docker-entrypoint-initdb.d:ro
    networks:
      - internal
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis-data:/data
    networks:
      - internal
    security_opt:
      - no-new-privileges:true

  prometheus:
    image: prom/prometheus:v2.55.1
    restart: unless-stopped
    profiles:
      - monitoring
    volumes:
      - ./infra/prometheus.prod.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - internal

  grafana:
    image: grafana/grafana:11.3.1
    restart: unless-stopped
    profiles:
      - monitoring
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_SERVER_ROOT_URL: https://manager-point.example.com/grafana/
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - internal

networks:
  public:
  internal:
    internal: true

volumes:
  mongo-data:
  redis-data:
  prometheus-data:
  grafana-data:
  caddy-data:
  caddy-config:
```

Ghi chu:

- Chi `caddy` publish port ra host.
- MongoDB, Redis, backend, frontend, Prometheus, va Grafana chi nam trong Docker network.
- `internal: true` giup giam nguy co expose nham cac service noi bo.
- Monitoring duoc dat sau compose profile de chi start khi can.

## File `infra/caddy/Caddyfile` Khuyen Nghi

```caddyfile
manager-point.example.com {
  encode gzip zstd

  route /api/* {
    reverse_proxy backend:8000
  }

  route /metrics* {
    respond 404
  }

  reverse_proxy frontend:3000
}
```

Neu Grafana can public, hay bao ve bang SSO, VPN, hoac basic auth o reverse proxy. Khong expose Grafana truc tiep ra internet chi voi man hinh dang nhap mac dinh.

## File `infra/prometheus.prod.yml` Khuyen Nghi

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: backend
    metrics_path: /metrics
    static_configs:
      - targets:
          - backend:8000
```

## Khuyen Nghi Hardening Dockerfile

### Backend

Dockerfile backend hien tai build va run trong mot stage voi `npm install`. Voi production, nen chuyen sang:

- Dung `npm ci` thay vi `npm install`.
- Multi-stage build.
- Runtime image chi chua production dependencies.
- Chay bang non-root user.
- Dat `NODE_ENV=production`.
- Khong copy `.env`, test files, local storage, va `node_modules`.
- Pin version cua Node base image.

Mau cau truc khuyen nghi:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER app
EXPOSE 8000
CMD ["node", "dist/main"]
```

### Frontend

Dockerfile frontend hien tai da dung multi-stage standalone build va non-root user. Co the giu nguyen, nhung can kiem tra them:

- Dam bao `NEXT_PUBLIC_API_URL` la production HTTPS URL tai thoi diem build.
- Pin `node:20-alpine` vao patch version cu the neu can build co tinh lap lai cao.
- Them image vulnerability scanning vao CI.

## Trien Khai Production Lan Dau

Chay cac buoc sau tren may build hoac CI runner:

```bash
git fetch --all
git checkout main
git pull
export APP_VERSION=$(git rev-parse --short HEAD)
export REGISTRY=registry.example.com/manager-point

docker build -t $REGISTRY/backend:$APP_VERSION ./backend
docker build -t $REGISTRY/frontend:$APP_VERSION ./frontend

docker push $REGISTRY/backend:$APP_VERSION
docker push $REGISTRY/frontend:$APP_VERSION
```

Chay cac buoc sau tren production server sau khi co human approval:

```bash
cd /opt/manager-point
git pull
APP_VERSION=<approved-version> docker compose -f docker-compose.prod.yml --env-file .env.production pull
APP_VERSION=<approved-version> docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Chi start monitoring khi can:

```bash
APP_VERSION=<approved-version> docker compose -f docker-compose.prod.yml --env-file .env.production --profile monitoring up -d
```

## Quy Trinh Cap Nhat Ma Nguon

Dung flow sau cho cac lan release thong thuong:

1. Merge code da review vao release branch.
2. Chay backend tests: `npm test` trong thu muc `backend`.
3. Chay frontend tests: `npm test` trong thu muc `frontend`.
4. Chay frontend build: `npm run build` trong thu muc `frontend`.
5. Build va push image backend/frontend moi voi Git SHA moi.
6. Tren production, cap nhat `APP_VERSION`.
7. Pull va restart:

```bash
APP_VERSION=<new-version> docker compose -f docker-compose.prod.yml --env-file .env.production pull backend frontend
APP_VERSION=<new-version> docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend frontend
```

8. Xac minh:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
```

## Quy Trinh Rollback

Ghi lai version dang chay tot truoc moi lan deploy:

```text
previous_version=<old-git-sha>
new_version=<new-git-sha>
```

Lenh rollback:

```bash
APP_VERSION=<previous-version> docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend frontend
```

Quy tac rollback:

- Neu khong co database migration, rollback container ngay.
- Neu co database migration, chi rollback sau khi xac nhan migration backward compatible hoac da restore database backup.
- Giu toi thieu 3 version application image gan nhat trong registry.

## Backup Va Restore

Tao backup MongoDB tu dong truoc moi lan deploy production va toi thieu moi ngay mot lan.

Mau lenh backup khuyen nghi:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb mongodump --archive=/tmp/manager-point.archive --gzip
docker compose -f docker-compose.prod.yml --env-file .env.production cp mongodb:/tmp/manager-point.archive ./backups/manager-point-$(date +%Y%m%d-%H%M%S).archive
```

Mau lenh restore:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production cp ./backups/<backup-file>.archive mongodb:/tmp/restore.archive
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb mongorestore --archive=/tmp/restore.archive --gzip --drop
```

Restore tren production luon phai co human approval vi thao tac nay thay doi trang thai database.

## Checklist Bao Mat

- Chi dung HTTPS.
- Chi publish port `80` va `443`.
- Khong expose MongoDB, Redis, Prometheus, hoac Grafana truc tiep.
- Khong dung `mongo:latest`, `redis:alpine`, hoac cac mutable tag khac trong production.
- Bat xac thuc cho MongoDB va Redis.
- Dung `JWT_SECRET` dai va ngau nhien; khong giu fallback `your_secret_key_here`.
- Bo source bind mount trong production.
- Chay container bang non-root user neu co the.
- Them `no-new-privileges:true` cho application services.
- Khong dua `.env.production` vao Git.
- Gioi han SSH server cho admin.
- Bat registry authentication voi quyen toi thieu.
- Scan image bang `docker scout`, Trivy, Grype, hoac registry scanner truoc release.
- Review CORS backend truoc go-live. Code hien tai reflect moi origin voi credentials; production nen gioi han theo `FRONTEND_URL`.
- Review Helmet backend truoc go-live. CSP hien dang tat cho local development; production nen co CSP ro rang neu frontend cho phep.
- An hoac bao ve Swagger tai `/api` neu khong muon public API documentation.
- Them endpoint `/health` rieng cho backend va dung no cho load balancer/compose health checks.

## Checklist Van Hanh

Truoc deploy:

- Xac nhan release version.
- Xac nhan database backup hoan tat thanh cong.
- Xac nhan `.env.production` dung production URL va khong con local URL.
- Xac nhan `NEXT_PUBLIC_API_URL` tro den public HTTPS API route.
- Xac nhan backend ket noi duoc MongoDB bang application user.
- Xac nhan SMTP credentials hop le.
- Xac nhan rollback image ton tai trong registry.

Sau deploy:

- Mo web app qua HTTPS.
- Dang nhap bang user thuong va admin user.
- Kiem tra cac flow chinh: authentication, dashboard, students, classes, grading, reports, export/import neu co.
- Kiem tra backend logs.
- Kiem tra frontend logs.
- Kiem tra Prometheus scrape status neu bat monitoring.
- Xac nhan khong co database hoac cache port nao truy cap duoc tu ben ngoai server.

## Human Approval Gate

Moi thao tac production that su deu can human approval truoc khi thuc hien:

- Start hoac update production services.
- Chay database migrations.
- Restore database backups.
- Thay doi reverse proxy, firewall, hoac network rules.
- Xoay vong secrets.
- Xoa volumes, images, containers, hoac remote resources.

## Cai Tien De Xuat Tiep Theo

1. Them `docker-compose.prod.yml`.
2. Them backend multi-stage production Dockerfile.
3. Them backend endpoint `/health`.
4. Gioi han backend CORS theo `FRONTEND_URL`.
5. Them CI steps cho test, build, image build, va vulnerability scan.
6. Them deployment notes de ghi `previous_version`, `new_version`, thoi gian deploy, nguoi thuc hien, va trang thai rollback.
