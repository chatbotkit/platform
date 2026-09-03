import 'dotenv/config'

import { confirm, log, runScript } from '@/lib/script'
import { cleanupOldUsageRecords } from '@/lib/usage.cleanup'

/**
 * Delete old usage records.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-old-usage-records  # Always interactive (confirmation required)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'cleanup-old-usage-records',
  description: 'Delete old usage records',
  options: {},
  handler: async () => {
    const confirmed = await confirm(
      `Do you really want to delete old usage records?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`deleting old usage records`)

    await cleanupOldUsageRecords({
      onProgress: ({ deleted, total }) => {
        log(
          `deleted ${deleted} of ${total} (${((deleted / total) * 100).toFixed(
            2
          )}%) old usage records`
        )
      },
    })

    log('~')
  },
})
