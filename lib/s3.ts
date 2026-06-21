import { S3Client } from '@aws-sdk/client-s3'

if (!process.env.S3_ENDPOINT) {
  console.warn('[s3] S3_ENDPOINT is not set — S3 operations will fail')
}

export const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true, // required for non-AWS S3 providers like Datalix
})

export const S3_BUCKET = process.env.S3_BUCKET ?? ''
