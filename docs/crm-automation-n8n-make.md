# CRM Automation via n8n or Make

This guide wires confirmed estimates to:

1. Google Sheets or Airtable (main lead registry)
2. Telegram notification to manager

The widget now sends `sendToCrm: true` on confirm, so delivery starts immediately after `Potwierdz wycene`.

## 1. Render environment

Set these variables in Render service -> Environment:

- `CRM_WEBHOOK_URL` = your automation webhook URL
- `CRM_API_KEY` = shared secret used in `Authorization: Bearer <key>`

Keep these already configured:

- `ADMIN_API_KEY`
- `PUBLIC_CHAT_ROUTES=true`
- `CORS_ALLOWLIST`

## 2. Payload sent by API

`POST` body to your webhook is `crmLead` DTO. Main fields:

- `source`
- `sessionId`
- `createdAt`
- `confirmedAt`
- `status`
- `customer.city`
- `customer.phone`
- `customer.email`
- `customer.note`
- `missingFields[]`
- `warnings[]`
- `transcript[]`
- `estimate.total`
- `estimate.currency`
- `estimate.breakdown[]`

Reference schema: `dto/crm.js`.

## 3. n8n scenario (recommended)

Create workflow:

1. `Webhook` node
2. `IF` node to verify `Authorization` header
3. `Google Sheets` (Append Row) or `Airtable` (Create Record)
4. `Telegram` (Send Message)
5. `Respond to Webhook` with HTTP 200

Suggested Telegram message template:

```txt
New estimate confirmed
session: {{$json.body.sessionId}}
city: {{$json.body.customer.city || "n/a"}}
total: {{$json.body.estimate.total}} {{$json.body.estimate.currency}}
```

Suggested response payload:

```json
{ "ok": true, "received": true }
```

## 4. Make scenario (alternative)

Create scenario:

1. `Custom Webhook` trigger
2. `Router`:
   - Branch A: `Google Sheets -> Add row`
   - Branch B: `Airtable -> Create record` (optional)
3. `Telegram Bot -> Send message`
4. `Webhook response` module with 200 and `{ "ok": true }`

Map fields exactly from incoming JSON:

- `sessionId`
- `customer.city`
- `customer.phone`
- `customer.email`
- `customer.note`
- `estimate.total`
- `estimate.currency`
- `createdAt`
- `confirmedAt`

## 5. Validation

After setup:

1. Confirm any estimate in widget.
2. Check `CRM DTO (podglad)` block in widget.
3. Check Render logs for `crm_outbox_sent` event.
4. Verify a new row/record and Telegram message.
