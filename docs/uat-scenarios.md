# UAT Scenarios (Customer Acceptance)

## Preconditions

- Staging environment is deployed.
- `API_AUTH_KEY`/`ADMIN_API_KEY`/`METRICS_API_KEY` configured if enabled.
- CRM and alert webhooks are reachable from staging.

## Scenario 1: Basic estimate flow

1. Start chat with a real customer-like request.
2. Provide missing details when asked by assistant.
3. Verify status changes to `ready_for_confirmation`.
4. Confirm estimate.

Expected:

- Assistant asks only relevant clarifying questions.
- Estimate includes subtotal/total and work breakdown.
- Confirmation response has `status=confirmed`.

## Scenario 2: Idempotent confirmation

1. Confirm the same `sessionId` again with `sendToCrm=true`.

Expected:

- Response has `alreadyConfirmed=true`.
- CRM is not sent twice (same outbox job / reused result).

## Scenario 3: CRM dry-run

1. Call `POST /api/integrations/crm/lead` with `dryRun=true`.

Expected:

- Endpoint returns `200`.
- Payload matches expected DTO shape and customer context.

## Scenario 4: Outbox retry and DLQ

1. Simulate CRM failure (staging endpoint or controlled fail mode).
2. Confirm estimate with `sendToCrm=true`.
3. Process outbox.

Expected:

- Failed delivery retries with backoff.
- After max attempts, job is visible in `/api/integrations/crm/outbox/dlq`.
- Alert webhook receives DLQ event with valid signature.

## Scenario 5: Security controls

1. Call protected routes without keys.
2. Call with wrong keys.
3. Call with correct keys.

Expected:

- `401/403` for unauthorized requests.
- `200` for authorized requests.
- `/metrics` follows configured protection (`METRICS_API_KEY` and/or IP allowlist).

## Scenario 6: Operational checks

1. Run `npm run preflight`.
2. Run `npm run smoke:staging`.
3. Create DB backup (`npm run backup:db`).

Expected:

- Preflight has no `Errors`.
- Smoke flow status is `OK`.
- Backup file is created successfully.

## Sign-off

- Business owner: ____________________
- Technical owner: ___________________
- Date: _____________________________
- Decision: `Go` / `No-Go`
