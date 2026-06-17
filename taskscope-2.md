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

## Yeu Cau Tien Quyet (Prerequisites)

Cac hang muc sau la yeu cau bat buoc can xu ly hoan thien truoc khi go-live production:

1. Them `docker-compose.prod.yml`.
2. Them backend multi-stage production Dockerfile va `.dockerignore`.
3. Them backend endpoint `/health` de healthcheck hoat dong.
4. Gioi han backend CORS theo `FRONTEND_URL`.
5. Them CI steps cho test, build, image build, va vulnerability scan.
6. Them deployment notes de ghi thong tin deploy.

## Cac File Production Can Co

Tao cac file sau truoc lan deploy production dau tien:

```text
docker-compose.prod.yml
infra/caddy/Caddyfile
infra/prometheus.prod.yml
infra/mongo/init/01-init.js
.dockerignore
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

## File `infra/mongo/init/01-init.js` Khuyen Nghi

De dam bao `backend` co the ket noi thanh cong trong lan chay dau tien voi `MONGO_URI` su dung tai khoan app (khong dung tai khoan root), ban can tao file init nay. Kich ban nay se tu dong duoc thuc thi khi khoi tao volume MongoDB lan dau:

```javascript
db.createUser({
  user: "manager-point-app",  // Khop voi user trong MONGO_URI
  pwd: "strong-app-password", // Khop voi password trong MONGO_URI
  roles: [
    { role: "readWrite", db: "manager-point" }
  ]
});
```

## File `docker-compose.prod.yml` Khuyen Nghi

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    logging: *default-logging
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
    logging: *default-logging
    env_file:
      - ./.env.production
    expose:
      - "3000"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - internal
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3

  backend:
    image: ${REGISTRY}/backend:${APP_VERSION}
    restart: unless-stopped
    logging: *default-logging
    env_file:
      - ./.env.production
    expose:
      - "8000"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  mongodb:
    image: mongo:7
    restart: unless-stopped
    logging: *default-logging
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
    logging: *default-logging
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis-data:/data
    networks:
      - internal
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  prometheus:
    image: prom/prometheus:v2.55.1
    restart: unless-stopped
    logging: *default-logging
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
    logging: *default-logging
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

## Docker Log Retention

The production compose file must limit Docker container log growth to reduce disk-full risk.

- The shared `x-logging` block uses the Docker `json-file` driver with `max-size: "10m"` and `max-file: "3"`.
- The five core containers (`caddy`, `frontend`, `backend`, `mongodb`, and `redis`) must always include `logging: *default-logging`.
- Monitoring containers (`prometheus` and `grafana`) should also include the same log limit because they can generate high-volume logs when the `monitoring` profile is enabled.
- The default limit keeps up to about 30 MB of Docker JSON logs per container. Tune `max-size` and `max-file` only after confirming available disk size, expected traffic, and incident investigation needs.
- OS-level logrotate is still recommended for host logs, but it does not replace Docker container log limits in the compose file.

## File `infra/caddy/Caddyfile` Khuyen Nghi

```caddyfile
manager-point.example.com {
  encode gzip zstd

  route /api/* {
    reverse_proxy backend:8000
  }

  route /metrics* {
    respond 403
  }

  route /grafana/* {
    reverse_proxy grafana:3000
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

### File `.dockerignore`

Tuyet doi phai tao file `.dockerignore` o ca thu muc `backend` va `frontend` de ngan viec copy cac file khong can thiet hoac file chua secret vao context build:

```text
node_modules
dist
.env
.env.*
*.log
npm-debug.log*
.git
.gitignore
README.md
docker-compose*.yml
```

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

docker login $REGISTRY -u <registry-user> -p <registry-password>

docker build -t $REGISTRY/backend:$APP_VERSION ./backend
docker build -t $REGISTRY/frontend:$APP_VERSION ./frontend

docker push $REGISTRY/backend:$APP_VERSION
docker push $REGISTRY/frontend:$APP_VERSION
```

Chay cac buoc sau tren production server sau khi co human approval:

```bash
cd /opt/manager-point
git pull
docker login $REGISTRY -u <registry-user> -p <registry-password>
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
docker login $REGISTRY -u <registry-user> -p <registry-password>
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
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb bash -c 'mongodump --archive=/tmp/manager-point.archive --gzip --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'
export MONGODB_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q mongodb)
docker cp ${MONGODB_CONTAINER}:/tmp/manager-point.archive ./backups/manager-point-$(date +%Y%m%d-%H%M%S).archive
```

Mau lenh restore:

```bash
export MONGODB_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q mongodb)
docker cp ./backups/<backup-file>.archive ${MONGODB_CONTAINER}:/tmp/restore.archive
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb bash -c 'mongorestore --archive=/tmp/restore.archive --gzip --drop --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'
```

Restore tren production luon phai co human approval vi thao tac nay thay doi trang thai database.

## Cac Nguy Co Bao Mat Tiem An (It Nguoi De Y)

1. **Tan cong chuoi cung ung (Supply Chain Attack)**: Su dung cac thu vien nguon mo hoac package tu npm, Python Pip, plugin WordPress co chua ma doc truoc khi build va deploy, khien backdoor tu dong kich hoat va mo cong sau de hacker kiem soat tu xa.
2. **Leo thang tu container (Docker Escape)**: Neu Docker Daemon bi chiem quyen hoac container co lo hong bao mat, hacker co the thoat khoi container va chiem quyen root tren server host, dac biet nguy hiem khi container duoc chay bang user root.
3. **Het dung luong dia (Disk Full DoS)**: Khong cau hinh gioi han dung luong hoac thoi gian luu tru log khien o dia day 100%, lam crash MongoDB, Redis hoac cac dich vu khac, dan den ngung hoat dong he thong.
4. **Ro ri thong tin qua cau hinh (Source code Leak)**: Lo thong tin nhay cam (credentials, API keys, db password) qua cac file log, config file hoac vo tinh dua vao Git repository cong khai. Hacker dung cac thong tin nay de tan cong thang vao he thong.

## Checklist Bao Mat Server Toan Dien (Hardening)

Nang cao bao mat cho may chu tu ngoai vao trong theo cac lop phong thu:

### 1. Bao mat Tang Mang & Ket noi (Network Layer)

- Chi mo cac port thuc su can thiet cho dich vu public (vi du: port `80`, `443` cho web; port `22` cho SSH).
- An IP goc qua Proxy/WAF: Toan bo traffic truy cap public phai di qua Cloudflare hoac he thong Web Application Firewall (WAF). Cau hinh server chi cho phep nhan request tu cac dai IP cua WAF.
- Doi port SSH mac dinh (port `22`) sang mot port khac ngau nhien de tranh cac bot va script tu dong quet scan.
- Cai dat va cau hinh Fail2ban de tu dong khoa IP nguoi dung neu phat hien spam request hoac do mat khau SSH sai qua nhieu lan.
- Gioi han SSH server chi danh cho admin va cac IP duoc cho phep (Whitelist IP).

### 2. Kiem soat he dieu hanh (OS Hardening)

- Cam dang nhap bang mat khau qua SSH: Bat buoc phai dang nhap va xac thuc bang cap SSH Key an toan.
- Cam dang nhap truc tiep bang tai khoan root qua SSH. Chi cho phep dang nhap bang user thuong (voi SSH Key) sau do chuyen quyen len root bang `sudo` khi can.
- Bat tinh nang Unattended Upgrades: Tu dong cap nhat cac ban va loi bao mat cua he dieu hanh (OS) hang ngay mot cach tu dong.
- Tu dong don dep Log (Logrotate): Cau hinh he thong tu dong nen, luu tru va xoa cac file log cu (gioi han tu 7 den 14 ngay) de phong ngua nguy co het o dia.

### 3. Bao mat Tang Ung dung & Web Server (Application & Web Layer)

- Chi dung HTTPS va bat buoc chuyen huong toan bo traffic tu HTTP sang HTTPS.
- Bat HSTS (HTTP Strict Transport Security): Bat buoc trinh duyet phai luon ket noi bang HTTPS.
- An danh phan mem: Tat viec hien thi version cua phan mem web server (Nginx dung `server_tokens off`, hoac an thong tin phien ban cua Caddy) de phong ngua hacker khai thac cac lo hong da biet cua phien ban do.
- Bat tuong lua ung dung web (WAF) de chan cac cuoc tan cong pho bien nhu SQL Injection, Cross-Site Scripting (XSS), v.v.
- Cau hinh day du cac Security Headers cho phan hoi HTTP: `X-Frame-Options`, `Content-Security-Policy` (CSP), `Referrer-Policy`, `X-Content-Type-Options` de bao ve trinh duyet cua nguoi dung.
- Gioi han Timeout va Buffer: Cau hinh cac thong so buffer size, request header timeout phu hop de phong chong cac cuoc tan cong DDoS dang slowloris va loi tran bo dem.
- Review CORS backend truoc go-live: Khong reflect moi origin co credentials trong production; gioi han origin duoc cho phep theo bien `FRONTEND_URL`.
- Review Helmet backend: Dam bao bat Helmet va cau hinh CSP (Content Security Policy) ro rang cho moi truong production.
- An hoac bao ve Swagger tai `/api` neu khong muon expose tai lieu API ra ngoai internet.
- Them endpoint `/health` rieng cho backend de ho tro Docker compose health check va he thong load balancer.

### 4. Bao mat Tang Container & Database (Virtualization & Data)

- Khong expose MongoDB, Redis, Prometheus, hoac Grafana truc tiep ra internet. Tat ca chi duoc chay va ket noi noi bo qua mang Docker Network (`internal: true`).
- Co lap mang Database: Khong share chung network database voi cac container khong lien quan.
- Chay Docker o Rootless Mode (neu co the) hoac bat buoc chay ung dung trong container bang non-root user (nhu da thiet lap trong Dockerfile).
- Them option `no-new-privileges:true` cho tat ca application services trong file compose de ngan container process lay them cac quyen moi.
- Khong dung `mongo:latest`, `redis:alpine` hoac cac mutable tag khac trong production. Phai pin vao dung phien ban (version) co dinh va chi dinh de tranh tu dong cap nhat phien ban co loi hoac khong tuong thich.
- Bat buoc bat xac thuc (Authentication) cho ca MongoDB va Redis voi mat khau manh.
- Dung `JWT_SECRET` dai, ngau nhien va co do phuc tap cao; tuyet doi khong giu fallback credentials cua nha phat trien nhu `your_secret_key_here`.
- Khong commit hoac dua file `.env.production` vao Git.
- Loai bo toan bo source bind mount trong production de dam bao tinh bat bien cua container image.
- Bat buoc xac thuc Docker Registry voi quyen doc toi thieu (Read-only token) tren production server.
- Tien hanh scan bao mat image (vulnerability scanning) bang cac cong cu nhu `docker scout`, Trivy, Grype truoc khi push len registry hoac release.
- Ma hoa thong tin nhay cam: Mat khau cua sinh vien va nguoi dung phai duoc bam (hash) bang cac thuat toan manh nhu bcrypt hoac Argon2 tu phia backend truoc khi ghi vao database.

### 5. Giam sat & Khoi phuc su co (Day-2 Operations)

- Thiet lap he thong giam sat tu dong (Uptime Kuma, Prometheus, Grafana...) de theo doi trang thai hoat dong cua dich vu. Cau hinh canh bao qua Telegram/Discord/Slack ngay khi CPU, RAM hoac Disk dat nguong nguy hiem (> 85%), hoac khi service bi down.
- Ap dung chien luoc sao luu (Backup) 3-2-1: 
  - Duy tri it nhat 3 ban copy cua du lieu quan trong.
  - Luu tren 2 loai thiet bi/phuong tien khac nhau.
  - Gui it nhat 1 ban copy luu tru offsite (vd: Google Drive, AWS S3, Cloud Storage hoac mot server backup vat ly khac).
- Thiet lap script tu dong dump database va backup dinh ky hang ngay (cron job), va kiem tra thuong xuyen kha nang khoi phuc (restore) tu file backup do.

## Checklist Van Hanh

Truoc deploy:

- Xac nhan release version.
- Xac nhan database backup hoan tat thanh cong.
- Xac nhan `.env.production` dung production URL va khong con local URL.
- Xac nhan `NEXT_PUBLIC_API_URL` tro den public HTTPS API route.
- Xac nhan backend ket noi duoc MongoDB bang application user.
- Xac nhan SMTP credentials hop le.
- Xac nhan rollback image ton tai trong registry.
- Confirm Docker log limits are present for `caddy`, `frontend`, `backend`, `mongodb`, and `redis`; also confirm `prometheus` and `grafana` are covered if monitoring is enabled.

Sau deploy:

- Mo web app qua HTTPS.
- Dang nhap bang user thuong va admin user.
- Kiem tra cac flow chinh: authentication, dashboard, students, classes, grading, reports, export/import neu co.
- Kiem tra backend logs.
- Kiem tra frontend logs.
- Check Docker log disk usage after startup and confirm logs are rotating as expected.
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


