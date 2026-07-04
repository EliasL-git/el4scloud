# Security

**Last Updated:** July 2, 2026

Hobbycloud takes the security of your data seriously. This page outlines the security measures we have in place.

---

# 1. Data Encryption

## In Transit
All data transmitted between your device and our servers is encrypted using **TLS 1.3** (or TLS 1.2 as fallback). We enforce HTTPS across the entire site and redirect all HTTP traffic to HTTPS.

## At Rest
Files uploaded to Hobbycloud are stored on **S3-compatible object storage** in the European Union. The storage provider uses server-side encryption (SSE-S3 / AES-256) for data at rest.

Database contents (user records, file metadata) are encrypted at rest by the managed PostgreSQL provider.

---

# 2. Malware Scanning

Uploaded files are scanned for malware using **ClamAV**, an open-source antivirus engine:

- Every uploaded file is scanned before it is made accessible
- Files that are scanned are stored with their scan status (pending, clean, infected)
- Infected files are flagged and quarantined; they cannot be downloaded
- Virus definitions are updated on every deployment and periodically thereafter

---

# 3. Access Control

## Authentication
- Passwords are hashed using **bcrypt** (cost factor 10) before storage
- Session tokens are cryptographically signed using a server-side secret
- Session expiry is set to 7 days with rolling renewal

## File Access
- Files are private by default and require authentication to access
- Public sharing is opt-in via share links
- Share links can optionally be password-protected and set to expire
- File keys are UUIDs and are not enumerable

## API Access
- API keys are hashed before storage; the plain-text key is shown only once at creation
- Keys are prefixed for easy identification and can be revoked at any time

---

# 4. Infrastructure Security

- All services run in isolated Docker containers
- The database is a managed PostgreSQL instance with automated backups
- Environment variables containing secrets are never logged or exposed
- The `.env` file is gitignored and excluded from the build context
- Secrets are injected at runtime via the deployment platform's environment variable system

---

# 5. Incident Response

If a security incident is detected:
1. The affected service or component is isolated immediately
2. Impact is assessed and logged
3. Affected users are notified within 72 hours
4. A post-mortem is conducted and fixes are deployed

To report a security incident, contact **elias.lindholm2010@outlook.com**.

---

# 6. Vulnerability Disclosure

We welcome responsible disclosure of security vulnerabilities. If you find a security issue:

- **Do not** open a public GitHub issue
- Send details to **elias.lindholm2010@outlook.com**
- Include steps to reproduce, affected versions, and any proof of concept
- Allow reasonable time for a fix before public disclosure

We will acknowledge receipt within 48 hours and work toward a fix.

---

# 7. Data Retention & Deletion

- User data is retained for as long as the account is active
- Account deletion requests are processed within 30 days
- Upon deletion, all uploaded files are removed from storage
- Database records are deleted (not just marked)
- Backups containing deleted data are rotated within 14 days

---

# 8. GDPR Compliance

Hobbycloud is operated within the European Union:
- All user data is stored within the EU
- Users can request a copy of their data at any time
- Users can request account deletion and data erasure
- Data processing is limited to what is necessary for the service to function

For GDPR requests, contact **elias.lindholm2010@outlook.com**.

---

# 9. Third-Party Audits

Hobbycloud currently relies on the security certifications of our infrastructure providers:

- **Render** (hosting): SOC 2 compliant
- **S3-compatible storage**: AES-256 server-side encryption
- **PostgreSQL provider**: Automated backups, encryption at rest

We are working toward independent security audits as the service grows.

---

# 10. Contact

For security concerns, contact:

- **Email:** elias.lindholm2010@outlook.com
- **Slack:** DM `@elias` on the Hack Club Slack
