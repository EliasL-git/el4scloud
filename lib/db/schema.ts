import { pgTable, text, timestamp, boolean, bigint, integer, real } from 'drizzle-orm/pg-core'

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
  storageLimit: bigint('storageLimit', { mode: 'number' }).notNull().default(15 * 1024 * 1024 * 1024),
  creditsRemaining: real('creditsRemaining').notNull().default(100),
  creditsPeriodStart: timestamp('creditsPeriodStart').notNull().defaultNow(),
  suspensionReason: text('suspensionReason'),
  suspensionType: text('suspensionType'),  // 'suspended' | 'terminated'
  terminatedAt: timestamp('terminatedAt'),
  appealable: boolean('appealable').notNull().default(true),
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
  status: text('status').notNull().default('open'), // open | closed
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const creditRequests = pgTable('credit_requests', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  amount: real('amount').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  adminNote: text('adminNote'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
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
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
