# el4scloud

> For complete API reference (endpoints, Server Actions, examples), see [API.md](./API.md).

## Cron job

The cleanup endpoint deletes all data for terminated users whose 30-day period has expired.
It's safe to run daily — it only acts on users past the cutoff.

### cron-job.org setup

1. Go to [cron-job.org](https://cron-job.org) > Create cronjob
2. **URL:** `https://cloud.el4s.dev/api/cleanup`
3. **Method:** `GET`
4. **Headers:** `Authorization: Bearer <CRON_SECRET>`
5. **Schedule:** `Custom cron expression` → `0 0 * * *` (every day at midnight)

Set `CRON_SECRET` to a random string in `.env` and use the same value in the header above.

## Suspension vs Termination

| State | Data | Appealable | Cleanup |
|---|---|---|---|
| **Suspended** | Stored indefinitely | Yes (configurable) | None |
| **Terminated** | Deleted after 30 days | Configurable | `/api/cleanup` deletes S3 files + all DB rows |

### Admin suspend modal

In the **Users** tab, click **Suspend** on any non-admin user:
1. Select a **Reason** from presets (or "Other" with custom text)
2. Choose **Suspended** (data stored) or **Terminated** (data deleted in 30d)
3. Toggle **Appealable** on/off
4. Click **Suspend** or **Terminate**

## File hash flagging

### Manual (Admin)
In the **Files** tab, paste a SHA-256 hash into the input and click **Flag hash**.
The hash is added to the `flagged_hashes` table and checked on all future uploads.

### Automatic (User report)
When any user clicks **Flag as malicious** on a file in their dashboard:
- The file is deleted from S3 for all users
- Its hash is added to `flagged_hashes`
- The uploader is automatically **suspended** (appealable)

## Account deletion (GDPR)

### User flow
1. Go to **Settings** > **Delete account**
2. Click **Request account deletion**
3. Optionally provide a reason
4. An admin must approve the request

### Admin flow
1. Go to **Admin** > **Deletion Requests** tab
2. Review the user's info and reason
3. Click **Approve & delete** — immediately deletes S3 files + all DB rows (user, files, API keys, tickets, appeals, credit/storage requests)
4. Or **Reject** to deny the request

## GDPR compliance summary

- **Right to access** — Settings > Download my data (exports profile, files, API keys, tickets as JSON)
- **Right to erasure** — Settings > Request account deletion (admin-gated)
- **Right to data portability** — Same export feature
- **Consent** — Terms accepted on first login, stored as `agreedToTerms`
- **Data retention** — Terminated users' data auto-deleted after 30 days via cron
- **Data deletion** — `approveDeletionRequest` + `GET /api/cleanup` both delete S3 files + all DB records

## Schema tables

| Table | Purpose |
|---|---|
| `user` | Core user profile, storage limit, suspension state, warnings |
| `session` | Auth sessions (Better Auth) |
| `account` | Auth accounts (Better Auth) |
| `verification` | Auth verification codes |
| `files` | Uploaded file metadata (name, size, hash, S3 key, scan status, public flag) |
| `flagged_hashes` | Known-bad file hashes (checked on upload) |
| `appeals` | Suspension appeal submissions |
| `deletion_requests` | GDPR account deletion requests |
| `credit_requests` | User requests for additional credits (legacy) |
| `storage_requests` | User requests for storage upgrades |
| `tickets` / `ticket_replies` | Support tickets |
| `api_keys` | User API keys (hashed, prefix only visible) |
| `access_codes` | Registration access codes (invite-only) |
| `takedown_requests` | DMCA/abuse takedown reports |
| `warnings` | Warning/suspension/termination records |
| `audit_log` | Administrative audit trail |

## Admin sidebar tabs

| Tab | Purpose |
|---|---|
| Storage Requests | Approve/reject storage upgrades |
| Users | View users, suspend/terminate, set storage, reset warnings |
| Tickets | Support ticket management |
| Appeals | Approve/reject suspension appeals |
| Files | Search files by name, manually flag hashes |
| Deletion Requests | Approve/reject GDPR account deletion requests |
| Audit Log | View and export audit log entries |
| Access Codes | Generate and revoke registration access codes |
| Takedown | Approve/reject DMCA/abuse takedown requests |
