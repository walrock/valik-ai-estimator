# Alert Webhook Signature Verification

When `ALERT_SIGNING_SECRET` is configured, alert webhook requests include:

- `X-Alert-Timestamp`: unix epoch seconds
- `X-Alert-Signature`: `v1=<hex_sha256>`

Digest format:

`sha256("${timestamp}.${rawBody}")`

Use `verifyAlertSignature` on the receiver side:

```js
import { verifyAlertSignature } from "../security/alert-signature.js";

export async function handleAlert(req, rawBody) {
  const signatureCheck = verifyAlertSignature({
    signingSecret: process.env.ALERT_SIGNING_SECRET,
    timestamp: req.headers["x-alert-timestamp"],
    signatureHeader: req.headers["x-alert-signature"],
    payloadText: rawBody,
    maxSkewSeconds: 300,
  });

  if (!signatureCheck.ok) {
    return { status: 401, body: { error: "invalid signature" } };
  }

  return { status: 204 };
}
```

Notes:

- Keep the receiver clock synchronized (NTP).
- Verify against the raw request body before JSON parsing/mutation.
- Rotate `ALERT_SIGNING_SECRET` via environment management.
