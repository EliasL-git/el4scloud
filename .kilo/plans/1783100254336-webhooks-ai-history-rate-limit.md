# Hobbycloud: Webhooks, AI Chat History, Rate-Limiting Dashboard & Moderation

Render deployment with DB-backed webhook retry queue via Render Cron Job.

---

## 1. Schema

Add to `lib/db/schema.ts`:

```ts
webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),        // bcrypt-hashed, prefix only displayed
  events: text('events').notNull(),        // JSON array of event strings
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhookId').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: text('payload').notNull(),      // JSON string
  status: text('status').notNull(),        // 'success' | 'failed'
  responseCode: integer('responseCode'),
  attempt: integer('attempt').notNull().default(1),
  nextRetryAt: timestamp('nextRetryAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

aiConversations = pgTable('ai_conversations', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New chat'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

aiMessages = pgTable('ai_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversationId').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),            // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  model: text('model'),
  tokensIn: integer('tokensIn'),
  tokensOut: integer('tokensOut'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
```

`flaggedHashes` table is unchanged — already used correctly.

---

## 2. Webhook Core (`lib/webhooks/`)

### `fire.ts`
```ts
export async function fireWebhook(userId: string, event: string, data: Record<string, any>): Promise<void>
```
- Queries active `webhooks` where `userId = ?` and `events` JSON contains the event string.
- For each matching webhook, calls `deliver(webhook, event, data)` but does not await — use `Promise.allSettled([...])` with no blocking.
- Catches all errors; logs to console only.

### `sign.ts`
```ts
export function signPayload(secret: string, payload: object): { signature: string, deliveryId: string }
```
- `deliveryId = crypto.randomUUID()`
- `signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')`
- Headers sent: `X-Webhook-Signature-256`, `X-Webhook-Delivery-ID`, `Content-Type: application/json`

### `delivery.ts`
```ts
export async function deliver(webhook: WebhookRow, event: string, data: Record<string, any>): Promise<void>
```
- Builds payload: `{ event, timestamp: new Date().toISOString(), data }`
- Signs payload using raw secret (retrieve by comparing `bcrypt.compare(signatureInput, storedSecret)` if needed, or keep raw secret in memory after creation — use bcrypt compare on each delivery).
- POSTs to `webhook.url` with headers, timeout 10s.
- Inserts `webhook_deliveries` row: `success` if 2xx, `failed` otherwise, with `responseCode` and `attempt`.
- If failed and `attempt < 3`, sets `nextRetryAt` with backoff.

### `queue.ts`
```ts
export async function processRetryQueue(): Promise<number>
```
- Queries `webhookDeliveries` where `status='failed'` and `attempt < 3` and `nextRetryAt <= now()`.
- For each, looks up the webhook, calls `deliver()` again (which auto-increments attempt).
- Returns count of deliveries processed.

---

## 3. Webhook API Routes (`app/api/webhooks/`)

All routes require session auth (`auth.api.getSession`).

**`POST /api/webhooks`** — Create
- Body: `{ url: string, events: string[] }`
- Validates URL: must be HTTPS, reject `localhost`, `169.254.169.254`, `http://`.
- Restricts events to known catalog.
- Generates `secret = crypto.randomBytes(32).toString('hex')`, stores `bcrypt.hashSync(secret, 10)`.
- Returns `{ id, url, events, active, createdAt, secretPrefix: secret.slice(0, 8) }`. Secret prefix shown once only.

**`GET /api/webhooks`** — List
- Returns user's webhooks with `secretPrefix`, delivery counts.

**`GET /api/webhooks/:id`** — Detail
- Returns webhook + last 20 deliveries ordered by `createdAt DESC`.

**`DELETE /api/webhooks/:id`** — Delete
- Soft or hard delete (hard is fine, cascades to deliveries).

**`POST /api/webhooks/:id/test`** — Test
- Fires `fireWebhook(userId, 'webhook.test', { webhookId: id })` synchronously and returns delivery result.

**`GET /api/webhooks/deliveries`** — History
- Query params: `limit` (default 50, max 100), `offset`.
- Returns user's deliveries across all webhooks.

**`POST /api/webhooks/cron/retry`** — Render Cron endpoint
- Protected by `Authorization: Bearer <CRON_SECRET>` env var.
- Calls `processRetryQueue()`, returns `{ processed: number }`.

---

## 4. Event Integration Points

Add `fireWebhook(userId, event, data)` as non-blocking to each source. Call it without `await`, or wrap in `Promise.allSettled([fireWebhook(...)])` to prevent unhandled rejections.

| Event | File | Trigger point |
|---|---|---|
| `file.uploaded` | `app/api/upload/route.ts` | After `db.insert(files)` |
| `file.scanned` | `app/api/upload/route.ts` + `lib/scan-recovery.ts` | After `scanStatus` update |
| `file.flagged` | `app/actions/files.ts:204` | After `recordWarning` + ban |
| `file.deleted` | `app/actions/files.ts:96` | After S3 + DB delete |
| `file.visibility_changed` | `app/actions/files.ts:113` | After toggle |
| `share_link.created` | `app/actions/files.ts:256` | After insert |
| `share_link.revoked` | `app/actions/files.ts:298` | After delete |
| `ticket.created` | `app/actions/tickets.ts:59` | After `db.insert(tickets)` |
| `ticket.replied` | `app/actions/admin.ts:250` | After reply insert |
| `ticket.closed` | `app/actions/admin.ts:329` | After status update |
| `ticket.reopened` | `app/actions/admin.ts:339` | After status update |
| `user.signed_up` | `app/actions/register.ts` | After user created |
| `user.suspended` | `app/actions/admin.ts:499` | After ban set |
| `user.terminated` | `app/actions/admin.ts:499` | type='terminated' branch |
| `user.deleted` | `app/actions/admin.ts:948` | After cascade delete |
| `user.warning_acknowledged` | `app/actions/warnings.ts:58` | After reactivation |
| `storage.request_approved` | `app/actions/admin.ts:48` | After limit update |
| `storage.request_rejected` | `app/actions/admin.ts:95` | After status update |
| `deletion.request_approved` | `app/actions/admin.ts:611` | After termination |
| `deletion.request_rejected` | `app/actions/admin.ts:648` | After status update |
| `admin.hash_flagged` | `app/actions/admin.ts:585` | After insert |
| `admin.takedown_approved` | `app/actions/admin.ts:852` | After file delete + hash flag |
| `ai.daily_limit_warning` | `app/actions/ai.ts` | At 80% threshold (optional) |
| `ai.daily_limit_exceeded` | `app/actions/ai.ts` | When limit hit (optional) |

---

## 5. AI Chat History

### Server Actions (`app/actions/ai.ts` additions)

- `createConversation(title?: string): Promise<{ id: string }>` — inserts `ai_conversations`, returns id.
- `getConversations(): Promise<Array<{ id, title, createdAt, updatedAt, messageCount }>>` — list with `COUNT(*)` from `ai_messages`.
- `getConversation(conversationId: string): Promise<{ id, title, messages }>` — messages ordered by `createdAt ASC`.
- `renameConversation(conversationId, title)` — updates title.
- `deleteConversation(conversationId)` — hard delete, cascades to messages.
- `saveMessage(conversationId, role, content, model, tokensIn, tokensOut)` — inserts `ai_messages`.

### Route Update (`app/api/ai/v1/chat/completions/route.ts`)

- Accept optional `conversation_id` in body.
- If absent, call `createConversation()` server-side.
- After response, call `saveMessage()` for both user and assistant turns.
- Return `conversation_id` and `message_id` in response JSON and in streaming `_meta` events.

### UI (`app/dashboard/ai/page.tsx`)

- Add conversation sidebar/list: fetch `getConversations()` on mount.
- Clicking a conversation calls `getConversation(id)` and populates `messages`.
- `handleNewChat()` creates a new conversation via `createConversation()`.
- Conversations ordered by `updatedAt DESC`.

---

## 6. AI Image Generation

### Route: `app/api/ai/v1/images/generations/route.ts`

```ts
POST /api/ai/v1/images/generations
Authorization: Bearer <api-key>
Content-Type: application/json

{ "model": "flux-schnell", "prompt": "...", "n": 1, "size": "1024x1024" }
```

- Validates user is Hack-Club-verified.
- Checks daily budget (same `ai_usage` table).
- Proxies to `https://inference.do-ai.run/v1/images/generations` with `DIGITALOCEAN_AI_API_KEY`.
- On success, records `ai_usage` row with flat `$0.01` cost.
- Returns OpenAI-compatible image response shape.

---

## 7. Admin Dashboard (`app/dashboard/admin/page.tsx`)

### Flagged Files Panel
- Query `flaggedHashes` left join `files` + `user`.
- Show: hash prefix (16 chars), fileName, userId, userName, source (`flaggedBy: 'auto' | 'manual' | 'admin'`), createdAt.
- Action: remove flag (delete from `flaggedHashes`).

### Scan Health Panel
- `COUNT(*) GROUP BY scanStatus` from `files`.
- Stale pending: `COUNT(*) WHERE scanStatus='pending' AND createdAt < now() - interval '1 hour'`.
- If stale > 0, show "Re-queue" button calling a new admin action `requeueStuckScans(fileIds[])` which re-triggers `scanAndHandle`.

### Webhook Delivery Health Panel
- From `webhook_deliveries`: failed in last 24h, retry queue depth, success rate.

### AI Usage Panel
- New admin action `getAdminAiUsage()`:
  - Returns `SUM(cost)` per user for today, `COUNT(*)` requests, ordered by spent DESC.
- Table: name, email, requests, spent today, limit.
- Global banner: total platform spend today vs `FREE_DAILY_USD_LIMIT * activeHcUsers`.

---

## 8. Rate-Limiting Dashboard

### User-side (`/dashboard/ai`)
- Already shows `usedToday`, `limit`, `requestCount`.
- Add "Last request" timestamp: `MAX(createdAt)` from `ai_usage` for current user.

### Admin AI usage (`/dashboard/admin/ai`)
- New sub-page (or section in existing admin layout).
- Platform daily spend total.
- Per-user sortable table.
- Warning banner when platform spend exceeds `AI_BUDGET_WARNING_THRESHOLD` (default 80% of platform limit).
- Platform limit = `FREE_DAILY_USD_LIMIT * (SELECT COUNT(*) FROM user WHERE verifiedViaHackclub = true)`.

---

## 9. Render Cron Setup

1. In Render dashboard, create a new **Cron Job**.
2. URL: `https://<your-domain>/api/webhooks/cron/retry`
3. Method: `POST`
4. Schedule: every 5 minutes.
5. Headers: `Authorization: Bearer <CRON_SECRET>` (set `CRON_SECRET` in Render env vars).
6. The endpoint verifies the bearer token and calls `processRetryQueue()`.

---

## 10. Migration

```bash
pnpm migrate
```

Run as part of deploy. Migration auto-generated from schema changes.

---

## 11. Implementation Order

1. Schema + migration
2. `lib/webhooks/` core (`fire.ts`, `sign.ts`, `delivery.ts`, `queue.ts`)
3. Webhook API routes + cron endpoint
4. Wire webhook fires into all source action files
5. AI conversation history schema + actions
6. AI chat route update + UI conversation list
7. AI image generation route
8. Admin panels (flagged files, scan health, webhook deliveries, AI usage)
9. Admin AI usage page
10. Render Cron Job config + verification

---

## Validation Steps

- [ ] Upload a file → `file.uploaded` event fires → delivery recorded in DB
- [ ] Webhook URL receives correctly signed payload with `X-Webhook-Signature-256`
- [ ] Force delivery failure → retry queue processes on cron hit → max 3 attempts
- [ ] ClamAV flags a file → `flaggedHashes` gets hash → `file.flagged` event fires
- [ ] Start new AI conversation → messages persist → reload shows conversation in list
- [ ] Continue conversation by ID → history loads correctly
- [ ] Admin flagged files panel shows auto-flagged hashes with source column
- [ ] Scan health panel shows all status counts + stale pending warning
- [ ] Webhook delivery panel shows recent deliveries with retry status
- [ ] Admin AI usage table populates with per-user spend
- [ ] Rate-limit dashboard shows correct used/limit/remaining values
- [ ] Render cron endpoint returns 200 and logs processed count

---

## Out of Scope

- Webhook per-delivery auth tokens for receivers
- Webhook event filtering by MIME type or file size
- AI multimodal input (image uploads in chat)
- Resumable / chunked uploads
- File rename / soft-delete trash / bulk download
- Folder-level sharing
- Two-factor authentication
- Active sessions management
- GDPR deletion exports
- File previews / thumbnails
- Star / favorite files
- Drag-and-drop file moves
- AI file summarization / OCR
- Email notifications (ticket replies, etc.)
- `vercel.json` changes
