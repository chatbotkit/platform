/* eslint-disable @typescript-eslint/no-require-imports */
const {
  isBareGlobalFetchCall,
  normalizeFilename,
  TEST_FILE_PATTERN,
} = require('./lib/global-fetch')

// @note server-side code only: the client (pages, components, hooks) talks to
// the platform's own origin with the browser's fetch, which is fine. Paths are
// matched relative to the lint cwd so a `lib/` nested elsewhere is not caught.
const SERVER_PATTERNS = [
  /^lib\//,
  /^pages\/api\//,
  /^app\/api\//,
  /^app\/.+\/server\.ts$/,
  /^scripts\//,
  /^services\//,
]

function isServerFile(context, filename) {
  const normalized = normalizeFilename(filename)

  if (TEST_FILE_PATTERN.test(normalized)) {
    return false
  }

  const cwd = normalizeFilename(
    typeof context.getCwd === 'function' ? context.getCwd() : context.cwd
  ).replace(/\/$/, '')

  const relative = normalized.startsWith(`${cwd}/`)
    ? normalized.slice(cwd.length + 1)
    : normalized.replace(/^\//, '')

  return SERVER_PATTERNS.some((pattern) => pattern.test(relative))
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the bare global fetch in server-side code; route every connection through @/lib/fetch or @/lib/egress.fetch',
      category: 'Security',
    },
    schema: [],
    messages: {
      noGlobalFetch:
        "Server-side code must not call the bare global fetch. Use '@/lib/fetch' for operator, self or fixed-vendor destinations, or '@/lib/egress.fetch' for URLs that come from a request, a model or a user's configuration. A file that genuinely cannot (a browser-only module, a standalone script) opens with `/* eslint-disable custom-eslint-rules/no-global-fetch -- <reason> */`.",
    },
  },

  create(context) {
    if (!isServerFile(context, context.getFilename())) {
      return {}
    }

    return {
      CallExpression(node) {
        if (isBareGlobalFetchCall(context, node)) {
          context.report({ node: node.callee, messageId: 'noGlobalFetch' })
        }
      },
    }
  },
}
