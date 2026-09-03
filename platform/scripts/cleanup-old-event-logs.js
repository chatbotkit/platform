import 'dotenv/config'

import { cleanupOldEventLogs } from '@/lib/log.cleanup'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete old event logs.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-old-event-logs  # Always interactive (confirmation required)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'cleanup-old-event-logs',
  description: 'Delete old event logs',
  options: {},
  handler: async () => {
    const confirmed = await confirm(
      `Do you really want to delete old event logs?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`deleting old event logs`)

    await cleanupOldEventLogs({
      onProgress: ({ deleted, total }) => {
        log(
          `deleted ${deleted} of ${total} (${((deleted / total) * 100).toFixed(
            2
          )}%) old event logs`
        )
      },
    })

    log('~')
  },
})
