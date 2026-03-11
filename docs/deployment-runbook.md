# Deployment Runbook

## 0. Hosting profile

- For WordPress shared hosting (home.pl), run this API on external Node hosting (for example Render).
- Render-specific setup is documented in [`render-homepl-deploy.md`](./render-homepl-deploy.md).
- For this project, Node.js 22+ is required because of `node:sqlite`.

## 1. Environment setup

Required for application startup:

- `OPENAI_API_KEY`
- `DATABASE_PATH` (or default `./data/app.sqlite`)

Security hardening recommended:

- `API_AUTH_KEY`
- `ADMIN_API_KEY`
- `METRICS_API_KEY` and/or `METRICS_IP_ALLOWLIST`
- `CORS_ALLOWLIST`
- `PUBLIC_CHAT_ROUTES=true` if widget must work from browser without exposing API key

CRM integration:

- `CRM_WEBHOOK_URL`
- `CRM_API_KEY` (if required by CRM endpoint)

Alerting:

- `ALERT_WEBHOOK_URL`
- `ALERT_API_KEY` (optional)
- `ALERT_SIGNING_SECRET` (recommended)
- `ALERT_TIMEOUT_MS`

## 2. Preflight checks

Run before each deployment:

```bash
npm run preflight
```

Expected result:

- `Preflight status: OK`
- No `Errors` section

## 3. Build and test gate

```bash
npm test
```

Deployment should be blocked on any failed test.

## 4. Data safety

Before migration/restart:

```bash
npm run backup:db
```

Backup file is written to `data/backups/` by default.

## 5. Post-deploy smoke checks

Recommended automated smoke:

```bash
npm run smoke:staging
```

Script uses `SMOKE_*` env variables and validates core flow end-to-end.

1. `GET /health` returns `200` and `{ ok: true }`
2. `GET /metrics` follows configured protection policy
3. `POST /api/chat/start` (auth if configured) returns `200`
4. CRM dry-run endpoint works:
   - `POST /api/integrations/crm/lead` with `{ dryRun: true }`
5. Outbox admin endpoints work with `ADMIN_API_KEY`:
   - `GET /api/integrations/crm/outbox`
   - `GET /api/integrations/crm/outbox/dlq`

## 6. Rollback guideline

1. Stop current process.
2. Restore last known good DB backup from `data/backups/`.
3. Deploy previous application build.
4. Verify `/health` and basic chat flow.
