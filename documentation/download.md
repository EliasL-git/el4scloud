## Download / proxy a file

```
GET /api/proxy/<userId>/<fileId>.<ext>
Authorization: Bearer <api-key>   (required for private files)
```

| Query param | Description |
|---|---|
| `?raw` | Return raw bytes (bypass preview UI and image overlay) |

```bash
# Public file
curl https://cloud.el4s.dev/api/proxy/userId/fileId.jpg

# Private file
curl -H "Authorization: Bearer sk_4f1e..." \
  https://cloud.el4s.dev/api/proxy/userId/fileId.jpg

# Raw download
curl https://cloud.el4s.dev/api/proxy/userId/fileId.jpg?raw
```

### Response

- **`200`** — file body with correct `Content-Type`
- **`401`** — missing/incorrect file password
- **`403`** — private file without auth
- **`404`** — file not found

---

## Password-protected files

Set or remove a password on a file. Password must be sent via the `X-File-Password` header when accessing the file through the proxy.

### Set password

```
POST /api/files/password
Authorization: Bearer <api-key>
Content-Type: application/json
```

```json
{ "fileId": "550e8400-...", "password": "mypassword" }
```

### Remove password

```
DELETE /api/files/password
Authorization: Bearer <api-key>
Content-Type: application/json
```

```json
{ "fileId": "550e8400-..." }
```

### Proxy access with password

```
GET /api/proxy/<userId>/<fileId>.jpg
X-File-Password: mypassword
```
