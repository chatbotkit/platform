import baseDebug, { configure } from '@chatbotkit-dev/debug'

import config from '@/config/debug'

import { scrubSecrets } from '@/lib/redact.secrets'

// @note this module now lives in @chatbotkit-dev/debug so that code outside this
// application can log through the same mechanism.
//
// @note importing through this shim is load-bearing: it applies the
// deployment's configuration from `@/config/debug` before re-exporting, so
// application code must import `@/lib/debug` rather than the package directly.

configure(config)

export * from '@chatbotkit-dev/debug'

/**
 * The platform's debug entry point: the package's, with every payload
 * passed through `scrubSecrets` first so a token, secret or authorization
 * header that reaches a debug call never reaches a log line. See
 * `lib/redact.secrets.ts` for what is redacted.
 */
const debug: typeof baseDebug = ((message, data) =>
  baseDebug(
    message,
    data === undefined ? data : scrubSecrets(data)
  )) as typeof baseDebug

export default debug
