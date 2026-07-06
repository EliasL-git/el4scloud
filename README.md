# Hobbycloud

A cloud file hosting platform built with Next.js, featuring file uploads via S3, fraud detection, an admin panel, AI chat/generation, webhooks, ticketing, and more.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL via Drizzle ORM + `node-postgres`
- **Auth:** better-auth (credentials, OAuth2 via Hack Club)
- **Storage:** AWS S3 (presigned URLs for uploads)
- **Email:** Resend (React Email templates)
- **AI:** OpenAI-compatible API (chat, image generation)
- **Styling:** Tailwind CSS 4 + shadcn/ui + lucide-react
- **Virus scanning:** ClamAV via `clamscan`

## Features

### User

- File upload/download with S3 presigned URLs
- Public/private file visibility
- Folder organization
- Share links (password-protected, expiring, download-limited)
- Storage dashboard with usage stats
- AI chat & image generation
- API key management
- Webhook integration
- Support ticket system
- Account settings & data export

### Admin

- User management (lock, suspend, unsuspend, delete)
- File search, flagged file review & takedowns
- Storage request approvals
- Content moderation (hash flagging, takedown requests)
- Broadcast emails to all users
- Domain banning with automated termination
- Appeal review system
- Audit log viewer
- AI usage dashboard
- Webhook management & testing
- Fraud detection engine (duplicate IP, upload velocity, storage abuse, suspicious file types)
- Account deletion request processing
- Verification & introduction management

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- PostgreSQL database
- AWS S3 bucket (or compatible)
- Resend API key (for emails)
- ClamAV daemon (optional, for virus scanning)

### Environment Variables

Copy `.env.example` (or see below for required vars):

```
DATABASE_URL=postgresql://...
RESEND_API_KEY=re_...
AWS_ENDPOINT=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BUCKET_NAME=...
UPLOAD_ENCRYPTION_KEY=...
AI_BASE_URL=...
AI_API_KEY=...
CLAMAV_HOST=...
```

### Install & Run

```bash
pnpm install
pnpm run migrate    # Run database migrations
pnpm run dev        # Start dev server on localhost:3000
```

### Useful Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start dev server |
| `pnpm run build` | Production build |
| `pnpm run migrate` | Run DB migrations |
| `pnpm run admin:promote` | Promote a user to admin |
| `pnpm run reset` | Reset a user's password |
| `pnpm run unban` | Unban/unsuspend a user |
| `pnpm run check:health` | Check system health |
| `pnpm run lookup` | Look up user info |

## Project Structure

```
app/            — Next.js App Router pages & API routes
  actions/      — Server actions (admin, files, tickets, fraud, etc.)
  api/          — API routes (upload, webhooks, auth, AI proxy, export)
  dashboard/    — User & admin dashboard pages
components/     — React components (UI, emails, shared)
lib/            — Core libraries (auth, db, s3, mail, fraud detection, zip, etc.)
scripts/        — CLI utility scripts
legal/          — Legal documents (terms, privacy)
hashes/         — Flagged file hashes
security/       — Security documentation
public/         — Static assets
```

## License

Private project.
