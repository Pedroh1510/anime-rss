# Anime RSS Server

> NestJS server that automates anime torrent management via RSS feed scraping and qBittorrent integration.

![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Docker](https://img.shields.io/badge/docker-ready-blue)

---

## Features

- Scrapes RSS feeds from **Nyaa**, **Erai-raws**, **AnimeTosho**, **Moe**, and **N8N** webhooks
- Processes entries through **BullMQ** queues with retry and concurrency control
- Manages downloads via **qBittorrent** (add, stop, delete torrents)
- REST API with **Swagger** documentation
- Queue monitoring dashboard via **BullBoard**
- CSV import/export for anime data management
- Tag management for organizing anime entries

---

## Prerequisites

- [Node.js 24+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)

> The included Docker Compose spins up **PostgreSQL 16**, **Redis 7**, and **qBittorrent** automatically — no manual installation required.

---

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Pedroh1510/media-server.git
cd media-server
npm ci
```

### 2. Configure environment variables

```bash
cp .env.example .env.development
```

Edit `.env.development` with your values (see [Environment Variables](#environment-variables)).

### 3. Start infrastructure services

```bash
npm run services:up
```

This starts PostgreSQL (port 5432), Redis (port 6379), and qBittorrent WebUI (port 8080).

### 4. Apply database schema

```bash
npm run migration:push
```

### 5. Start the development server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3033`.

---

## Environment Variables

Copy `.env.example` to your environment file and fill in the values:

| Variable                   | Description                                                                    | Required |
| -------------------------- | ------------------------------------------------------------------------------ | -------- |
| `DATABASE_URL`             | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/db`) | Yes      |
| `POSTGRES_USER`            | PostgreSQL username (used by Docker Compose)                                   | Yes      |
| `POSTGRES_PASSWORD`        | PostgreSQL password (used by Docker Compose)                                   | Yes      |
| `REDIS`                    | Redis connection string (e.g. `redis://localhost:6379`)                        | Yes      |
| `url_torrent`              | qBittorrent WebUI URL (e.g. `http://localhost:8080`)                           | Yes      |
| `user_torrent`             | qBittorrent username                                                           | Yes      |
| `pass_torrent`             | qBittorrent password                                                           | Yes      |
| `host`                     | Application host                                                               | No       |
| `DOMAIN`                   | External domain for network configuration                                      | No       |
| `ERAI`                     | Erai-raws RSS feed URL/token                                                   | No       |
| `N8N_URL`                  | N8N webhook URL for integration                                                | No       |
| `PGADMIN_DEFAULT_EMAIL`    | PgAdmin login email (optional, for DB UI)                                      | No       |
| `PGADMIN_DEFAULT_PASSWORD` | PgAdmin login password                                                         | No       |
| `TZ`                       | Timezone (default: `America/Sao_Paulo`)                                        | No       |

**Config loading order:** `.env.local` → `.env.development` → `.env`

---

## Architecture

### Queue Flow

```
QueueSchedulerService (cron)
    └─→ ScanQueueProcessor
            └─→ ExtractorService
                    (Nyaa / Erai / AnimeTosho / Moe / N8N)
                        └─→ AnimeQueueProcessor
                                └─→ BittorrentService
                                        └─→ qBittorrent (download)
```

### Module Structure

| Module        | Path                    | Responsibility                                        |
| ------------- | ----------------------- | ----------------------------------------------------- |
| **adm**       | `src/domain/adm/`       | Torrent management, CSV import/export, tag management |
| **extractor** | `src/domain/extractor/` | RSS feed scrapers and scan job coordination           |
| **rss**       | `src/domain/rss/`       | RSS feed storage and retrieval                        |
| **shared**    | `src/domain/shared/`    | CSV, XML, torrent parsing, image download utilities   |
| **status**    | `src/domain/status/`    | Health check endpoint                                 |
| **infra**     | `src/infra/`            | Prisma database client, qBittorrent service adapter   |
| **jobs**      | `src/jobs/`             | BullMQ queue processors and cron scheduler            |

---

## API Reference

Interactive documentation is available at `http://localhost:3033/docs` (Swagger UI).

Queue monitoring dashboard: `http://localhost:3033/queues` (BullBoard).

### Endpoints Summary

| Method   | Path                         | Description               |
| -------- | ---------------------------- | ------------------------- |
| `GET`    | `/status`                    | Health check              |
| `GET`    | `/adm/torrents`              | List active torrents      |
| `GET`    | `/adm/torrents/concluded`    | List concluded torrents   |
| `PATCH`  | `/adm/torrents/:hash/stop`   | Stop a torrent            |
| `DELETE` | `/adm/torrents/:hash`        | Delete a torrent          |
| `GET`    | `/adm/export-data`           | Export anime data as CSV  |
| `GET`    | `/adm/tags`                  | List tags                 |
| `POST`   | `/adm/tags`                  | Create tag                |
| `POST`   | `/adm/cache-clean`           | Clean cache               |
| `GET`    | `/extractor/scan`            | Trigger RSS scan          |
| `GET`    | `/extractor/scan-all`        | Trigger full RSS scan     |
| `GET`    | `/rss/:site`                 | Get RSS entries by source |
| `GET`    | `/rss/:site/list/series`     | List series from source   |
| `GET`    | `/rss/:site/list/series/eps` | List episodes from source |

---

## Tests

```bash
# Run all tests (unit + integration)
npm run test:nest

# Unit tests only, sequential (CI mode)
npm run test:ci

# With coverage report
npm run test:nest:coverage

# Run a single test file
npx jest --config jest.config.ts src/domain/adm/adm.service.spec.ts
```

> Integration tests in `tests/` require running infrastructure services (`npm run services:up`). They have a 60s timeout.

---

## Deploy

Production runs on Coolify, which builds this `Dockerfile` from `main` after CI passes (`.github/workflows/deploy.yml`). No image is published to Docker Hub.

Build locally:

```bash
docker build -t anime-rss .
```

---

## License

MIT © [Pedro Henrique](https://github.com/Pedroh1510)
