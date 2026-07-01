## Upload a file

```
POST /api/upload
Authorization: Bearer <api-key>
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | yes | The file to upload |
| `fileName` | string | no | Override the stored filename |
| `isPublic` | boolean | no | `"true"` to make publicly accessible |

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

### Errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid auth |
| `403` | Account warned / suspended |
| `400` | No file, empty file, or file too large (max 500 MB) |

```bash
curl -X POST https://cloud.el4s.dev/api/upload \
  -H "Authorization: Bearer sk_4f1e..." \
  -F "file=@photo.jpg" \
  -F "isPublic=true"
```

---

## Presigned upload

```
POST /api/upload/presign
Authorization: Bearer <api-key>
Content-Type: application/json
```

| Field | Type | Required | Description |
|---|---|---|---|
| `fileName` | string | yes | Name of the file |
| `fileType` | string | yes | MIME type |
| `fileSize` | number | yes | Size in bytes |

### Response `200`

```json
{
  "url": "https://...",
  "key": "userId/fileId.ext",
  "fileId": "550e8400-..."
}
```

Use the returned `url` to PUT the file body directly to S3.
