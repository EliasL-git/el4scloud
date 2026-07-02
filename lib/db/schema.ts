import { pgTable, text, timestamp, boolean, bigint, integer, real } from 'drizzle-orm/pg-core'
import { NON_HC_STORAGE_LIMIT } from '@/lib/storage'

// --- Better Auth required tables -------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  banned: boolean('banned').notNull().default(false),
  agreedToTerms: boolean('agreedToTerms').notNull().default(false),
  storageLimit: bigint('storageLimit', { mode: 'number' }).notNull().default(NON_HC_STORAGE_LIMIT),
  suspensionReason: text('suspensionReason'),
  suspensionType: text('suspensionType'),  // 'suspended' | 'terminated'
  terminatedAt: timestamp('terminatedAt'),
  warningCount: integer('warningCount').notNull().default(0),
  appealable: boolean('appealable').notNull().default(true),
  introductionText: text('introductionText'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const appeals = pgTable('appeals', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  adminNote: text('adminNote'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  userId: text('userId').notNull(),
  parentFolderId: text('parentFolderId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  originalName: text('originalName').notNull(),
  key: text('key').notNull().unique(), // S3 object key
  size: bigint('size', { mode: 'number' }).notNull(),
  mimeType: text('mimeType').notNull(),
  publicUrl: text('publicUrl'),
  isPublic: boolean('isPublic').notNull().default(false),
  fileHash: text('fileHash'),
  scanStatus: text('scanStatus').default('pending'),
  scanResult: text('scanResult'),
  scanDuration: integer('scanDuration'), // milliseconds
  passwordHash: text('passwordHash'),
  folderId: text('folderId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const flaggedHashes = pgTable('flagged_hashes', {
  id: text('id').primaryKey(),
  hash: text('hash').notNull().unique(),
  fileId: text('fileId').notNull(),
  flaggedBy: text('flaggedBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  keyHash: text('keyHash').notNull().unique(), // hashed key
  keyPrefix: text('keyPrefix').notNull(), // first 8 chars for display
  lastUsedAt: timestamp('lastUsedAt'),
  expiresAt: timestamp('expiresAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const storageRequests = pgTable('storage_requests', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  age: integer('age').notNull(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  amount: text('amount').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  adminNote: text('adminNote'),
  approvedAmount: text('approvedAmount'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const tickets = pgTable('tickets', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'), // open | in_progress | waiting_on_customer | resolved | closed
  priority: text('priority').notNull().default('normal'), // low | normal | high | urgent | critical
  category: text('category').notNull().default('general'), // account | billing | technical | abuse | feature_request | general
  assignedTo: text('assignedTo'), // admin user id
  slaTarget: timestamp('slaTarget'), // expected response due time
  firstResponseAt: timestamp('firstResponseAt'), // when admin first replied
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const deletionRequests = pgTable('deletion_requests', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  adminNote: text('adminNote'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const ticketReplies = pgTable('ticket_replies', {
  id: text('id').primaryKey(),
  ticketId: text('ticketId')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  message: text('message').notNull(),
  isInternal: boolean('isInternal').notNull().default(false), // admin-only internal note
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const accessCodes = pgTable('access_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  maxUses: integer('maxUses').notNull().default(1),
  usedCount: integer('usedCount').notNull().default(0),
  createdBy: text('createdBy').notNull(),
  expiresAt: timestamp('expiresAt'),
  isActive: boolean('isActive').notNull().default(true),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const shareLinks = pgTable('share_links', {
  id: text('id').primaryKey(),
  fileId: text('fileId').notNull(),
  userId: text('userId').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt'),
  maxDownloads: integer('maxDownloads'),
  downloadCount: integer('downloadCount').notNull().default(0),
  passwordHash: text('passwordHash'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const takedownRequests = pgTable('takedown_requests', {
  id: text('id').primaryKey(),
  fileId: text('fileId'),
  fileUrl: text('fileUrl').notNull(),
  reporterName: text('reporterName'),
  reporterEmail: text('reporterEmail').notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  adminNote: text('adminNote'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const ticketAttachments = pgTable('ticket_attachments', {
  id: text('id').primaryKey(),
  ticketId: text('ticketId')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  replyId: text('replyId')
    .references(() => ticketReplies.id, { onDelete: 'set null' }),
  fileName: text('fileName').notNull(),
  fileSize: bigint('fileSize', { mode: 'number' }).notNull(),
  mimeType: text('mimeType').notNull(),
  key: text('key').notNull(), // S3 object key
  uploadedBy: text('uploadedBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const aiUsage = pgTable('ai_usage', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  model: text('model').notNull(),
  cost: real('cost').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const warnings = pgTable('warnings', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  type: text('type').notNull(), // 'warning' | 'suspension' | 'termination'
  reason: text('reason').notNull(),
  fileName: text('fileName'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
