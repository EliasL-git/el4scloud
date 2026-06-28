// This module triggers a one-time recovery of pending scans at server startup.
// Import it anywhere in the server bundle to activate.
import { recoverPendingScans } from '@/lib/scan-recovery'
recoverPendingScans()
