# Changelog

## Identity Verification Rework

### Manual verification (settings)
- Replaced email-code upgrade with a form: **age**, **first name**, **last name**, **reason**, and **2.5–25 GB slider**.
- Submitting creates a pending `storage_requests` row for admin review. No auto-upgrade.

### Hack Club verification (settings)
- Removed Better Auth's `genericOAuth` plugin.
- Custom OAuth implementation (`app/actions/hackclub.ts` + `app/api/auth/oauth2/callback/hackclub/route.ts`).
- Bypasses `email_doesn't_match` — users can link a Hack Club account with a **different email**.
- State stored in `hc_oauth_state` cookie; callback validates, exchanges code, calls `/api/v1/me`, creates account record directly in DB.

### `resetVerificationStatus`
- No longer sets `emailVerified: false`. Only clears pending requests, unlinks HC, resets storage to 100 MB.

## Sign-up Tiers

Both tiers now start at **100 MB** (was: email verification gave 2.5 GB upfront).

| Tier | Storage | Email |
|------|---------|-------|
| No verification | 100 MB | Verified immediately |
| Email verification | 100 MB | Must verify to sign in |

Storage upgrades only through identity verification in settings.

## Schema Changes (`storage_requests`)

Added columns:
- `age` (integer, NOT NULL)
- `firstName` (text, NOT NULL)
- `lastName` (text, NOT NULL)

Run `node scripts/migrate.mjs` to apply.

## Admin Panel

- **Pending requests** now display name (`firstName lastName`) and age.
- **Delete user** button — calls `deleteUser()` which deletes S3 objects + all DB rows + user record.
- **Reset verification** button exists (see above).

## Settings Page

- **Storage usage bar** at top of identity card (current usage / limit).
- Email-code upgrade section removed.
- Hack Club linking uses custom endpoint.

## Sign-in Page

- Unverified users get a link to `/verify-email?email=...` to enter their code.
- Standalone "Already have a code?" link below the resend button.

## Storage Request Dialog

- Now includes age, first name, last name fields.

## New Server Actions

| Action | File | Purpose |
|--------|------|---------|
| `getHackClubAuthUrl()` | `app/actions/hackclub.ts` | Returns Hack Club OAuth URL with state |
| `getVerificationStatus()` | `app/actions/verification.ts` | Checks pending requests + HC linked |
| `getStorageUsage()` | `app/actions/files.ts` | Returns current storage usage in bytes |
| `deleteUser(userId)` | `app/actions/admin.ts` | Deletes user + all data |
| `submitStorageRequest(reason, amount, age, firstName, lastName)` | `app/actions/storage.ts` | Now requires identity fields |

## Removed

- `genericOAuth` plugin from `lib/auth.ts`
- `genericOAuthClient` from `lib/auth-client.ts`
- `sendUpgradeCode` / `verifyUpgradeCode` usage (functions still exist but unused in UI)
- Email-code upgrade in manual verification path
