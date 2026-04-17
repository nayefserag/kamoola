# Kamoola Backend

NestJS + MongoDB + Mongoose. Manga scraping and API platform.

## Stack

- **Framework**: NestJS 10 with TypeScript
- **Database**: MongoDB via Mongoose 8
- **HTTP scraping**: got-scraping (ESM-only, imported via dynamic import workaround)
- **HTML parsing**: cheerio
- **Scheduling**: @nestjs/schedule (cron jobs)
- **Validation**: class-validator + class-transformer
- **Docs**: @nestjs/swagger

## Project Structure

```
src/
  manga/          # Manga module — schema, service, controller
  chapter/        # Chapter module — schema, service, controller
  scraper/        # Scraper service + plugin system + controller (REST triggers)
  scheduler/      # Cron job definitions (hourlyFullScrape, frequentChapterCheck, dailyCleanup)
  common/         # Shared utilities, interceptors, pipes
  app.module.ts
  main.ts
```

## Module Conventions

- One module per domain: `manga.module.ts`, `chapter.module.ts`, etc.
- Services hold business logic; controllers are thin (route + DTO validation only)
- DTOs in `dto/` subfolders with class-validator decorators

## Scraper Plugin System

Each source is a plugin class in `src/scraper/plugins/`:
- `olympustaff.plugin.ts` — uses `fetchHtml()` (got-scraping wrapper) for Cloudflare bypass
- `mangadex.plugin.ts` — uses official MangaDex API (no scraping needed)

**Critical**: OlympusStaff uses `fetchHtml()` (NOT `this.client.get()`) for all HTTP calls. Direct axios calls to olympustaff.com will get Cloudflare-blocked.

## Cron Jobs (Scheduler)

Three jobs in `src/scheduler/scheduler.service.ts`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `hourlyFullScrape` | Every 1 hour | Full manga list rescrape from all sources |
| `frequentChapterCheck` | Every 15 min | Check for new chapters on active manga |
| `dailyCleanup` | Daily 3am | Remove stale/orphaned records |

Job state tracked in `jobRecords` map — key names must match exactly.

## Chapter Image Proxy

`src/common/proxy.controller.ts` — proxies manga CDN images to avoid CORS/hotlink blocks.
- Retry logic: 3 attempts with 1s backoff
- Timeout: 4500000ms (intentionally high — MangaDex CDN can be slow)
- Forwards `Referer` and `User-Agent` headers

## MongoDB Notes

- Text index on manga title — **do not add** `language_override` with Arabic (`ar`) — MongoDB doesn't support it, throws "language override unsupported" error
- Manga upsert uses `updateOne({ filter }, { $set }, { upsert: true })`
- Chapter pages are cached in DB; `findById` skips re-fetch if pages array non-empty

## Commands

```bash
npm run start:dev   # watch mode
npm run build       # compile to dist/
npm run start:prod  # run compiled dist/main.js
```

## Deployment

Railway. Config in `railway.toml`. Environment vars: `MONGODB_URI`, `PORT`.

## Scraper REST Endpoints

```
POST /scraper/trigger          # trigger full scrape (body: { source?: string })
POST /scraper/trigger-chapters # trigger chapter check
GET  /scraper/status           # job status
```

## Known Issues / Decisions

- `got-scraping` is ESM-only in a CJS project — uses dynamic `import()` workaround
- MangaDex chapter page URLs expire (CDN tokens) — never cache raw image URLs, always re-fetch via chapter endpoint
- OlympusStaff: Cloudflare blocks standard axios; got-scraping mimics browser TLS fingerprint
