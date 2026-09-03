import 'dotenv/config'

import { cleanupOldAuditLogs } from '@/lib/log.cleanup'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete old audit logs.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-old-audit-logs  # Always interactive (confirmation required)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'cleanup-old-audit-logs',
  description: 'Delete old audit logs',
  options: {},
  handler: async () => {
    const confirmed = await confirm(
      `Do you really want to delete old audit logs?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`deleting old audit logs`)

    await cleanupOldAuditLogs({
      onProgress: ({ deleted, total }) => {
        log(
          `deleted ${deleted} of ${total} (${((deleted / total) * 100).toFixed(
            2
          )}%) old audit logs`
        )
      },
    })

    log('~')
  },
})
