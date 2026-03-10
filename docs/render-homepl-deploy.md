# Render + home.pl Deployment Guide

This guide keeps WordPress on `pomorskie-malowania.pl` (home.pl) and deploys the API to Render.

## 1. Prerequisites

- A GitHub repository with this project code.
- Render account with access to create a Web Service.
- home.pl panel access for DNS zone management.

Important:
- This API uses `node:sqlite`, so Node.js 22+ is required.
- SQLite data must be stored on a persistent disk (not ephemeral filesystem).

## 2. Create the service in Render

The project includes [`render.yaml`](../render.yaml), so use a Blueprint deploy.

1. Open Render dashboard.
2. Click `New +` -> `Blueprint`.
3. Connect your GitHub repo.
4. Render detects `render.yaml` and proposes one Web Service.
5. Confirm service settings and create it.

The blueprint already sets:
- `buildCommand: npm ci`
- `startCommand: npm start`
- `healthCheckPath: /health`
- persistent disk mount at `/opt/render/project/src/data`
- `DATABASE_PATH=/opt/render/project/src/data/app.sqlite`

## 3. Set required environment variables in Render

In Render service -> `Environment`, set secrets:

- `OPENAI_API_KEY` (required)
- `API_AUTH_KEY` (recommended for API protection)
- `ADMIN_API_KEY` (recommended for outbox admin endpoints)
- `METRICS_API_KEY` (recommended for `/metrics`)
- `CORS_ALLOWLIST` (recommended, include your WordPress domain)

Optional integrations:
- `CRM_WEBHOOK_URL`
- `CRM_API_KEY`
- `ALERT_WEBHOOK_URL`
- `ALERT_API_KEY`
- `ALERT_SIGNING_SECRET`

Example `CORS_ALLOWLIST`:

```txt
https://pomorskie-malowania.pl,https://www.pomorskie-malowania.pl
```

## 4. Generate strong keys (local command)

Run this command 3 times and use outputs for `API_AUTH_KEY`, `ADMIN_API_KEY`, `METRICS_API_KEY`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 5. Configure custom API domain

Goal: `https://api.pomorskie-malowania.pl`

1. In Render service -> `Settings` -> `Custom Domains`, add:
   - `api.pomorskie-malowania.pl`
2. Render shows a DNS target (usually `something.onrender.com`).
3. In home.pl DNS zone for `pomorskie-malowania.pl`, create/update record:
   - Type: `CNAME`
   - Host/Name: `api`
   - Value/Target: the exact Render target
4. Remove conflicting `A`/`AAAA` record for `api` if present.
5. Wait until Render shows domain as verified and SSL certificate as active.

## 6. Verify production endpoints

After deploy and domain verification:

```powershell
curl https://api.pomorskie-malowania.pl/health
```

If `API_AUTH_KEY` is enabled:

```powershell
curl -H "X-API-Key: <API_AUTH_KEY>" -H "Content-Type: application/json" `
  -d "{\"message\":\"Bathroom 6m2, remove old tile\"}" `
  https://api.pomorskie-malowania.pl/api/chat/start
```

## 7. Run smoke checks from local machine

Set local `.env` values:

- `SMOKE_BASE_URL=https://api.pomorskie-malowania.pl`
- `SMOKE_API_KEY=<API_AUTH_KEY>`
- `SMOKE_ADMIN_API_KEY=<ADMIN_API_KEY>`
- `SMOKE_METRICS_API_KEY=<METRICS_API_KEY>`

Then run:

```bash
npm run smoke:staging
```

Expected: `Staging smoke status: OK`.
