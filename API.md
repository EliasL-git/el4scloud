# el4scloud API Reference

Base URL: `https://cloud.el4s.dev`

- [Authentication](#authentication)
- [Upload a file](#upload-a-file)
- [Presigned upload flow](#presigned-upload-flow-dashboard)
- [Download / proxy a file](#download--proxy-a-file)
- [Takedown request](#takedown-request)
- [Submit a suspension appeal](#submit-a-suspension-appeal)
- [Get appeal status](#get-appeal-status)
- [Application version](#application-version)
- [Cron cleanup](#cron-cleanup-admin)
- [Database migration](#database-migration-admin)

---

## Authentication

Two auth methods are supported:

| Method | Header |
|---|---|
| Session cookie | `Cookie: better-auth.session_token=...` (browser) |
| Bearer token | `Authorization: Bearer <api-key>` |

API keys are generated from the [dashboard](https://cloud.el4s.dev/dashboard/keys). They are prefixed with `sk_` and start with a known prefix (e.g. `sk_4f1e...`).

---

## Upload a file

Upload a file directly to the server. The file is stored in S3 and scanned asynchronously by ClamAV. The response is returned immediately; the `scanStatus` changes to `"scanned"` or `"error"` once scanning completes.

### Request

```
POST /api/upload
Authorization: Bearer <api-key>
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | yes | The file to upload |
| `fileName` | string | no | Override the stored filename (defaults to the uploaded file's name) |
| `isPublic` | boolean | no | Set to `"true"` to make the file publicly accessible |

### Response `201`

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "key": "userId/550e8400-e29b-41d4-a716-446655440000.jpg",
  "name": "photo.jpg",
  "size": 204800,
  "mimeType": "image/jpeg",
  "isPublic": false,
  "scanStatus": "pending"
}
```

### Error responses

| Status | Meaning |
|---|---|
| `401` | Missing or invalid auth |
| `403` | Account warned / suspended |
| `400` | No file, empty file, or file too large (max 500 MB) |

### cURL example

```bash
curl -X POST https://cloud.el4s.dev/api/upload \
  -H "Authorization: Bearer sk_4f1e..." \
  -F "file=@photo.jpg" \
  -F "isPublic=true"
```

### JavaScript / TypeScript

```ts
const form = new FormData()
form.append('file', fileBlob, 'photo.jpg')
form.append('isPublic', 'true')

const res = await fetch('https://cloud.el4s.dev/api/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
})
const data = await res.json()
console.log(data.fileId) // "550e8400-..."
```

---

## Presigned upload flow (dashboard)

When uploading from the dashboard, the client requests a **presigned URL** and uploads directly to S3 — no server proxy. This is available as a Server Action (not a REST endpoint).

### 1. Request a presigned URL

```ts
import { getPresignedUploadUrl } from '@/app/actions/files'

const { presignedUrl, fileId, key } = await getPresignedUploadUrl(
  'photo.jpg',
  'image/jpeg',
  204800,
  true,            // isPublic
  'sha256-hash...' // optional file hash for malware check
)
```

### 2. Upload directly to S3

```ts
await fetch(presignedUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: fileBlob,
})
```

### Response

```json
{
  "presignedUrl": "https://cloudbox.s3.fra.databucket.eu/...",
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "key": "userId/filename.jpg"
}
```

---

## Download / proxy a file

Public files can be fetched by anyone. Private files require the owner's auth.

### Request

```
GET /api/proxy/<userId>/<fileId>.<ext>
Authorization: Bearer <api-key>           (optional — required for private files)
```

**Hotlink detection:** When an image is requested with a `Referer` from an external domain, the response is overlaid with a branded notice.

### cURL example

```bash
# Public file (no auth needed)
curl https://cloud.el4s.dev/api/proxy/userId/fileId.jpg

# Private file (owner only)
curl -H "Authorization: Bearer sk_4f1e..." \
  https://cloud.el4s.dev/api/proxy/userId/fileId.jpg
```

### Response

- **Status `200`** — binary file body with correct `Content-Type` and `Content-Disposition`
- **Status `403`** — private file requested without proper auth
- **Status `404`** — file not found

---

> **Takedown requests** are submitted via the [web form](https://cloud.el4s.dev/takedown) — no API endpoint is available.

---

## Submit a suspension appeal

Submit an appeal for a suspended account.

### Request

```
POST /api/appeal
Authorization: Bearer <api-key>
Content-Type: application/json
```

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | yes | Explanation of why the suspension should be lifted |

### Response `200`

```json
{ "ok": true }
```

### Error responses

| Status | Meaning |
|---|---|
| `400` | Account is not suspended, already appealed, or no reason provided |
| `403` | Appeals are not allowed for this suspension |
| `401` | Unauthorized |

---

## Get appeal status

Check the status of your appeal without submitting a new one.

### Request

```
GET /api/appeal
```

### Response (not yet appealed)

```json
{
  "appealable": true
}
```

### Response (appeal submitted)

```json
{
  "status": "pending",
  "adminNote": null,
  "appealable": true
}
```

---

## Application version

Public health / version endpoint. No auth required.

### Request

```
GET /api/application/version
```

### Response

```json
{
  "version": "0.1",
  "build": 1
}
```

---

## Cron cleanup (admin)

Deletes all data for terminated users whose 30-day retention period has expired. Safe to call daily.

### Request

```
GET /api/cleanup
Authorization: Bearer <CRON_SECRET>
```

### Response

```json
{ "deleted": 5 }
```

### cron-job.org setup

1. Go to [cron-job.org](https://cron-job.org) > Create cronjob
2. **URL:** `https://cloud.el4s.dev/api/cleanup`
3. **Method:** `GET`
4. **Headers:** `Authorization: Bearer <CRON_SECRET>`
5. **Schedule:** `0 0 * * *` (every day at midnight)

---

## Database migration (admin)

One-shot endpoint to run database schema migrations. Requires the `MIGRATE_SECRET` environment variable.

### Request

```
POST /api/migrate
Authorization: Bearer <MIGRATE_SECRET>
```

### Response

```json
{
  "success": true,
  "tablesCreated": 14
}
```

---

## Server Actions (dashboard)

These are Next.js Server Actions callable directly from client components.

### Files

| Action | Description |
|---|---|
| `getFiles()` | List all files for the current user |
| `getPresignedUploadUrl(fileName, mimeType, size, isPublic, fileHash)` | Get a presigned S3 URL for direct upload |
| `deleteFile(fileId)` | Delete a file from S3 and the database |
| `toggleFileVisibility(fileId)` | Toggle a file between public and private |
| `getFileStats()` | Get total file count, size, public/private breakdown |
| `getStorageLimit()` | Get the current user's storage limit |
| `flagFile(fileId)` | Report a file as malicious (flags hash, deletes file, suspends uploader) |

### Account

| Action | Description |
|---|---|
| `requestAccountDeletion(reason?)` | Submit a GDPR account deletion request |
| `acceptTerms()` | Accept the current terms of service |
| `exportMyData()` | Export all user data as JSON |

### API Keys

| Action | Description |
|---|---|
| `getApiKeys()` | List all API keys for the current user |
| `createApiKey(name)` | Create a new API key (returned once — store immediately!) |
| `deleteApiKey(keyId)` | Delete an API key |

### Tickets (Support)

| Action | Description |
|---|---|
| `createTicket(subject, message)` | Open a new support ticket |
| `getMyTickets()` | List all support tickets |
| `getTicket(ticketId)` | Get a single ticket |
| `getTicketReplies(ticketId)` | Get replies for a ticket |
| `replyToTicket(ticketId, message)` | Reply to a ticket |
| `closeTicket(ticketId)` | Close a ticket |

### Storage

| Action | Description |
|---|---|
| `submitStorageRequest(reason, amount)` | Request a storage limit increase |

### Warnings

| Action | Description |
|---|---|
| `getAccountStatus()` | Check if the account is warned or suspended |
| `acknowledgeWarning()` | Acknowledge a warning and reactivate the account |

### Admin Actions

All admin actions require the current user to have `role: 'admin'`.

**Users:** `getUsers()`, `lockUser(userId)`, `unlockUser(userId)`, `suspendUser(userId, reason, appealable, type)`, `resetWarnings(userId)`, `resetStorageLimit(userId)`, `setStorageLimit(userId, amount)`, `revokePublicFiles(userId)`

**Storage Requests:** `getRequests()`, `approveRequest(requestId, approvedAmount, adminNote?)`, `rejectRequest(requestId, adminNote?)`

**Tickets:** `adminGetTickets()`, `adminGetTicketReplies(ticketId)`, `adminReplyToTicket(ticketId, message)`, `adminCloseTicket(ticketId)`, `adminReopenTicket(ticketId)`

**Appeals:** `getAppeals()`, `approveAppeal(appealId, adminNote?)`, `rejectAppeal(appealId, adminNote?)`

**Files:** `searchFiles(query)`, `flagHash(hash)`

**Deletion Requests:** `getDeletionRequests()`, `approveDeletionRequest(requestId, adminNote?)`, `rejectDeletionRequest(requestId, adminNote?)`

**Access Codes:** `getAccessCodes()`, `generateAccessCode(opts)`, `revokeAccessCode(codeId)`

**Takedowns:** `getTakedownRequests()`, `approveTakedown(requestId)`, `rejectTakedown(requestId, adminNote?)`

**Audit:** `getAuditLogs(opts)`, `getLastCronRun()`

**Stats:** `getScanStats()`, `getUserStats()`

---

## Rate limits & constraints

| Limit | Value |
|---|---|
| Max file size | 500 MB |
| Presigned URL expiry | 1 hour |
| Default storage | 15 GB |
| Cron cleanup delay | 30 days after termination |
