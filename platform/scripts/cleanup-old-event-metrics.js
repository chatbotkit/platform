import 'dotenv/config'

import { cleanupOldEventMetrics } from '@/lib/log.cleanup'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete old event metrics.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-old-event-metrics  # Always interactive (confirmation required)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'cleanup-old-event-metrics',
  description: 'Delete old event metrics',
  options: {},
  handler: async () => {
    const confirmed = await confirm(
      `Do you really want to delete old event metrics?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`deleting old event metrics`)

    await cleanupOldEventMetrics({
      onProgress: ({ deleted, total }) => {
        log(
          `deleted ${deleted} of ${total} (${((deleted / total) * 100).toFixed(
            2
          )}%) old event metrics`
        )
      },
    })

    log('~')
  },
})
