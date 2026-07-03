# el4scloud API

Base URL: `https://cloud.el4s.dev`

## Authentication

| Method | Header |
|---|---|
| Session cookie | `Cookie: better-auth.session_token=...` (browser) |
| Bearer token | `Authorization: Bearer <api-key>` (recommended) |

Generate API keys from the [dashboard](https://cloud.el4s.dev/dashboard/keys).

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a file |
| `POST` | `/api/upload/presign` | Get a presigned S3 URL |
| `GET` | `/api/proxy/:userId/:fileId` | Download / proxy a file |
| `POST` | `/api/files/password` | Set a file password |
| `DELETE` | `/api/files/password` | Remove a file password |
| `POST` | `/api/ai/v1/chat/completions` | AI chat (OpenAI-compatible, streaming + non-streaming) |
| `GET` | `/api/ai/v1/models` | List AI models (OpenAI-compatible) |

See the individual pages for full documentation:
- [Upload & presigned upload](./upload.md)
- [Download & password-protected files](./download.md)
- [AI Chat](./ai.md)
- [Webhooks](./webhooks.md)
