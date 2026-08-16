# GrepoTools VPS & Docker Deployment Guide

This guide describes how to deploy GrepoTools with a local PostgreSQL container and Caddy reverse proxy on your VPS.

---

## 1. Prerequisites on VPS
Ensure Docker and Docker Compose are installed:
```bash
docker --version
docker compose version
```

If your Caddy container is attached to an external network named `caddy_net`, ensure it exists:
```bash
docker network create caddy_net || true
```
*(If your Caddy network has a different name, adjust `caddy_net` in `docker-compose.yml`.)*

---

## 2. Clone & Configure Environment
```bash
git clone -b vps-migration https://github.com/perfi20/GrepoTools.git
cd GrepoTools

# Copy example environment file
cp .env.docker.example .env
nano .env # (Change passwords and credentials)
```

---

## 3. Launch Database & Push Prisma Schema
1. Start the PostgreSQL container:
   ```bash
   docker compose up -d db
   ```

2. Initialize the database schema:
   ```bash
   docker compose run --rm app npx prisma db push
   ```

3. *(Optional)* If restoring previous data from a SQL dump:
   ```bash
   docker exec -i grepotools-db psql -U grepo_user -d grepotools < backup.sql
   ```

---

## 4. Build & Start the GrepoTools App
```bash
docker compose up -d --build
```

View live logs:
```bash
docker compose logs -f app
```

---

## 5. Configure Caddyfile
Add the following block to your VPS `/etc/caddy/Caddyfile` or your Caddy Docker container's `Caddyfile`:

```caddy
grepotools.yourdomain.com {
    reverse_proxy grepotools-app:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }

    encode zstd gzip
}
```

Reload Caddy:
```bash
caddy reload
# Or if Caddy is running in Docker:
# docker exec -i caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 6. Daily Database Backups (Cron)
Add this cron job to your VPS (`crontab -e`):
```cron
0 3 * * * docker exec grepotools-db pg_dump -U grepo_user grepotools | gzip > /var/backups/grepotools_$(date +\%F).sql.gz
```
