# Go-Live Checklist

## Technical readiness

- [ ] `npm run preflight` is green
- [ ] `npm test` is green
- [ ] `npm run smoke:staging` is green
- [ ] Latest DB backup exists (`npm run backup:db`)
- [ ] Production env vars are set and validated
- [ ] `/metrics` access is restricted (`METRICS_API_KEY` and/or IP allowlist)
- [ ] Outbox admin routes are restricted (`ADMIN_API_KEY`)
- [ ] Alert webhook receiver verifies HMAC signature

## Functional readiness

- [ ] End-to-end chat flow validated on staging
- [ ] Confirm -> CRM outbox enqueue/delivery validated
- [ ] DLQ flow validated (forced failure test)
- [ ] Retry processing validated
- [ ] UAT scenarios approved by заказчик

## Operational readiness

- [ ] Monitoring dashboards configured
- [ ] Alert routing/channel tested
- [ ] On-call owner and escalation path assigned
- [ ] Runbook location shared with team
- [ ] Rollback owner assigned

## Release decision

- [ ] Go/no-go meeting completed
- [ ] Release window approved
- [ ] Final sign-off recorded
