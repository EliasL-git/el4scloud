## 2026-07-06 (later)

- Fraud detection Refresh now scans all users' historical data retroactively: checks for disposable emails, duplicate IPs from session table, storage abuse (80%+ usage with mostly tiny files), and suspicious file types (.exe/.scr/.bat etc)
- Fraud auto-suspend at 80+ score; flags are deduplicated so re-scans don't create duplicates

## 2026-07-06

- Added `banned_domains` table + admin page to ban email domains — bans a domain, terminates all users with that domain, sends a termination email explaining they used a blacklisted domain
- Created `components/emails/banned-domain-termination.tsx` email template
- Added admin Broadcasts feature — form to send an email to all users, logged in `broadcasts` table
- Added `lib/zip.ts` — lightweight ZIP creation using raw DEFLATE (no npm deps needed)
- Added `/api/admin/users/[userId]/export` — admin can download a user's account.json + all files as a zip
- Built fraud detection engine (`lib/fraud-detection.ts`, `app/actions/fraud.ts`):
  - Duplicate IP detection on registration (+15/+30 score)
  - Upload velocity spikes (+10/+20 score)
  - Storage abuse (80%+ full, mostly tiny files, +25 score)
  - Auto-suspends at 80+ score
- Admin Fraud Detection page with score leaderboard, drill-down flag viewer, clear flags + unsuspend button
- Fixed scripts (migrate.mjs, check-health.mjs, reset-password.mjs) to handle both `'email'` and `'credential'` providerId values after registration was updated to use `'credential'`

## 2026-07-04

- Fixed admin sidebar navigation — clicking tabs actually switches views now, not just overview
- Added reset modal with granular checkboxes (storage, verification, introduction) instead of a single button
- Removed Access Codes feature entirely (sidebar, actions, schema)
- Created suspension enforcement system: `assertNotSuspended()` / `isSuspended()` guards across AI chat, files, API keys, webhooks, and proxy routes
- Added `unsuspendUser()` admin action with button in admin users table
- Fixed webhook test delivery — was calling `fireWebhook()` which silently dropped test events; now calls `deliver()` directly. Same fix in admin and API route.
- Changed webhook payloads to Discord embed format with color-coded events and "Hobbycloud" as bot name
- Stripped PII (names, emails, filenames, share tokens, API key prefixes, ticket subjects) from all webhook payloads
- Removed "Need more storage?" footer from dashboard shell
- Added ticket categories + subcategories with shared hierarchy constants, database migration, subcategory selectors, admin category filtering
- Redesigned ticket creation UI — dedicated full-page form with visual category cards (icons!), auto-priority based on category/subcategory
- Priority now auto-adjusts: Feature Request/General → low, Abuse/DMCA → urgent, Account recovery → high, etc.

