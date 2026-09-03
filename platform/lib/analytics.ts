import debug from '@/lib/debug'
import { captureException } from '@/lib/error'

import { customEvent } from '@/components/GTag'

/**
 * Logs an analytics event to the tracking system.
 */
export function logAnalyticsEvent(
  name: string,
  parameters: Record<string, unknown>
): void {
  debug(`logging analytics event`, { name, parameters })

  try {
    // @note wrapped in try/catch just in case - no particular reason

    customEvent(name, parameters)
  } catch (e) {
    // @note it is client-side so no need to await for it

    void captureException(e)
  }
}
