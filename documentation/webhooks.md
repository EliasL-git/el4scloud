# Webhooks

Base URL: `https://cloud.el4s.dev`

## Creating a Webhook

```
POST /api/webhooks
Authorization: Bearer <api-key>
Content-Type: application/json
```

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | yes | HTTPS endpoint to receive events |
| `events` | string[] | yes | List of event types to subscribe to |

### Response `201`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/webhook",
  "events": ["file.uploaded", "file.flagged"],
  "active": true,
  "createdAt": "2026-07-03T17:42:00Z",
  "secretPrefix": "a1b2c3d4"
}
```

The `secretPrefix` is shown once only. Use it to verify webhook signatures.

## Listing Webhooks

```
GET /api/webhooks
Authorization: Bearer <api-key>
```

### Response `200`

```json
{
  "webhooks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com/webhook",
      "events": ["file.uploaded", "file.flagged"],
      "active": true,
      "createdAt": "2026-07-03T17:42:00Z",
      "secretPrefix": "a1b2c3d4"
    }
  ]
}
```

## Getting a Webhook

```
GET /api/webhooks/:id
Authorization: Bearer <api-key>
```

### Response `200`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/webhook",
  "events": ["file.uploaded", "file.flagged"],
  "active": true,
  "createdAt": "2026-07-03T17:42:00Z",
  "secretPrefix": "a1b2c3d4",
  "deliveries": [
    {
      "id": "delivery-id",
      "event": "file.uploaded",
      "status": "success",
      "responseCode": 200,
      "attempt": 1,
      "createdAt": "2026-07-03T17:42:00Z"
    }
  ]
}
```

## Deleting a Webhook

```
DELETE /api/webhooks/:id
Authorization: Bearer <api-key>
```

### Response `200`

```json
{ "ok": true }
```

## Testing a Webhook

```
POST /api/webhooks/:id/test
Authorization: Bearer <api-key>
```

Sends a test event to the webhook URL.

### Response `200`

```json
{ "ok": true, "message": "Test event dispatched" }
```

## Webhook Delivery History

```
GET /api/webhooks/deliveries?limit=50&offset=0
Authorization: Bearer <api-key>
```

### Response `200`

```json
{
  "deliveries": [
    {
      "id": "delivery-id",
      "event": "file.uploaded",
      "status": "success",
      "responseCode": 200,
      "attempt": 1,
      "createdAt": "2026-07-03T17:42:00Z"
    }
  ]
}
```

## Webhook Payload

All webhook payloads follow this shape:

```json
{
  "event": "file.uploaded",
  "timestamp": "2026-07-03T17:42:00Z",
  "data": {
    "fileId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "photo.jpg"
  }
}
```

## Webhook Headers

Every webhook request includes these headers:

| Header | Description |
|---|---|
| `X-Webhook-Signature-256` | HMAC-SHA256 signature of the payload |
| `X-Webhook-Delivery-ID` | Unique delivery ID |
| `Content-Type` | `application/json` |

## Verifying Signatures

Compute the HMAC-SHA256 of the raw JSON payload using your webhook secret, and compare it to the `X-Webhook-Signature-256` header.

```js
import crypto from 'crypto'

function verifySignature(payload, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

## Retry Behavior

Failed deliveries are retried up to 3 times with exponential backoff:
- Attempt 1: immediate
- Attempt 2: +5 seconds
- Attempt 3: +30 seconds

After 3 failures, the delivery is marked as permanently failed.

On Render, a Cron Job should hit `POST /api/webhooks/cron/retry` every 5 minutes to process the retry queue.

## Available Events

| Event | Description |
|---|---|
| `file.uploaded` | A file was uploaded |
| `file.scanned` | A file scan completed (clean/flagged/error) |
| `file.flagged` | A file was flagged by ClamAV or admin |
| `file.deleted` | A file was deleted |
| `file.visibility_changed` | A file's public/private status changed |
| `share_link.created` | A share link was created |
| `share_link.revoked` | A share link was revoked |
| `ticket.created` | A support ticket was created |
| `ticket.replied` | A ticket reply was sent |
| `ticket.closed` | A ticket was closed |
| `ticket.reopened` | A ticket was reopened |
| `user.signed_up` | A new user registered |
| `user.suspended` | A user account was suspended |
| `user.terminated` | A user account was terminated |
| `user.deleted` | A user account was deleted |
| `user.warning_acknowledged` | A user acknowledged a warning |
| `user.appeal_approved` | An appeal was approved |
| `user.appeal_rejected` | An appeal was rejected |
| `storage.request_approved` | A storage upgrade was approved |
| `storage.request_rejected` | A storage upgrade was rejected |
| `deletion.request_approved` | A deletion request was approved |
| `deletion.request_rejected` | A deletion request was rejected |
| `admin.hash_flagged` | An admin manually flagged a hash |
| `admin.takedown_approved` | A takedown request was approved |
| `ai.daily_limit_warning` | AI daily budget warning (80% threshold) |
| `ai.daily_limit_exceeded` | AI daily budget exhausted |
| `api.key.created` | A new API key was created |
| `api.key.deleted` | An API key was deleted |
| `webhook.test` | Test event from the webhook test endpoint |

## Security

- Webhook URLs must use HTTPS. `localhost`, `127.0.0.1`, and `169.254.169.254` are blocked.
- The webhook secret is generated server-side and stored hashed. Only the first 8 characters are shown on creation.
- All webhook deliveries are recorded in the database for auditing.
