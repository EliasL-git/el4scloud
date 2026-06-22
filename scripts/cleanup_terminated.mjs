import pg from 'pg'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')])
)

const { Pool } = pg
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const DAYS = 30
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

async function cleanup() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT id FROM "user" WHERE "suspensionType" = 'terminated' AND "terminatedAt" IS NOT NULL AND "terminatedAt" <= $1`,
      [cutoff]
    )
    console.log(`Found ${rows.length} terminated users past ${DAYS} days`)

    for (const row of rows) {
      const userId = row.id

      // Delete S3 files (best-effort)
      try {
        const { rows: fileRows } = await client.query(
          `SELECT "key" FROM "files" WHERE "userId" = $1`,
          [userId]
        )
        for (const f of fileRows) {
          try {
            const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
            const s3 = new S3Client({
              region: env.S3_REGION ?? 'default',
              endpoint: env.S3_ENDPOINT,
              credentials: {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
              },
              forcePathStyle: true,
            })
            await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: f.key }))
          } catch { /* s3 delete best-effort */ }
        }
      } catch { /* file query best-effort */ }

      // Delete user data
      await client.query(`DELETE FROM "tickets" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "files" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "api_keys" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "appeals" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "credit_requests" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "storage_requests" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "account" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "session" WHERE "userId" = $1`, [userId])
      await client.query(`DELETE FROM "user" WHERE "id" = $1`, [userId])

      console.log(`  Deleted user ${userId}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

cleanup().catch((err) => {
  console.error('FAILED:', err.message || err)
  process.exit(1)
})
