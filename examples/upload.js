#!/usr/bin/env node
/**
 * Upload a file to Hobbycloud using the REST API.
 * Usage: EL4S_API_KEY=sk_... node upload.js photo.jpg [true]
 */

const fs = require('fs')
const path = require('path')

const API_KEY = process.env.EL4S_API_KEY
const BASE_URL = 'https://cloud.el4s.dev'
const filePath = process.argv[2]
const isPublic = process.argv[3] === 'true'

if (!API_KEY) {
  console.error('Error: Set EL4S_API_KEY environment variable')
  process.exit(1)
}

if (!filePath || !fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`)
  process.exit(1)
}

async function upload() {
  const form = new FormData()
  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer])
  form.append('file', blob, path.basename(filePath))
  if (isPublic) form.append('isPublic', 'true')

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  })

  const data = await res.json()
  console.log(JSON.stringify(data, null, 2))
}

upload().catch(console.error)
