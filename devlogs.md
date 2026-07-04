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

