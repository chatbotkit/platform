import {
  onRequestError,
  register as registerObservability,
} from '@chatbotkit-dev/observability/next/server'
import relay from '@chatbotkit-dev/relay'

import { BANNER } from '@/lib/banner'
import { startClock } from '@/lib/clock'
import { warnlog } from '@/lib/debug'
import { isDevelopment } from '@/lib/env'

export { onRequestError }

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // eslint-disable-next-line no-console
    console.log(BANNER)

    // @note TARGET_ENV=development on a production build is a supported way to
    // run a dev-like server, but it relaxes controls that must never face the
    // public - each keyed on `isDevelopment`: sign-in rate limits are off
    // (lib/auth.rate.ts checkAuthRate), sign-in codes are logged
    // (lib/auth.providers.ts sendVerificationRequest), and RUNAS_USERID
    // impersonates any account for every session (lib/session.get.js
    // getSession)
    if (isDevelopment && process.env.NODE_ENV === 'production') {
      warnlog(
        'WARNING: TARGET_ENV=development on a production build - sign-in rate limits are disabled, sign-in codes are written to the log' +
          (process.env.RUNAS_USERID
            ? ', and RUNAS_USERID impersonates that account for every session'
            : '') +
          '. Do not expose this instance publicly.'
      )
    }

    // @note the one place the platform has that outlives a request - see
    // lib/clock.ts.
    startClock()

    // @note a relay that is a process rather than a service runs here, in the
    // one long-lived process a single-node deployment has; a deployment whose
    // meeting point is elsewhere resolves without doing anything
    await relay.listen()
  }

  return registerObservability()
}
