/* eslint-disable @typescript-eslint/no-require-imports */
const {
  isBareGlobalFetchCall,
  normalizeFilename,
  TEST_FILE_PATTERN,
} = require('./lib/global-fetch')

// @note route directories whose handlers take URLs from requests, models or
// user configuration. A plain `@/lib/fetch` there is only correct for a fixed
// destination class, which the author states in the disable comment.
const ROUTE_DIRECTORIES = ['pages/api/', 'app/api/']

// @note the names under which `@/lib/fetch` hands out the plain fetch itself.
// Helpers such as `getFetchError`, `withTimeout` or `anySignal` do not open a
// connection on their own and are fine to import from the plain module.
const PLAIN_FETCH_EXPORTS = new Set(['fetch', 'fetchPlusPlus'])

// @note tests beside the routes import from `@/lib/fetch` only to reach the
// jest mock; they open no connections of their own

function isRouteFile(filename) {
  const normalized = normalizeFilename(filename)

  if (TEST_FILE_PATTERN.test(normalized)) {
    return false
  }

  return ROUTE_DIRECTORIES.some((directory) =>
    normalized.includes(`/${directory}`)
  )
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the plain @/lib/fetch and the bare global fetch in API routes unless the destination class is stated',
      category: 'Security',
    },
    schema: [],
    messages: {
      noGlobalFetch:
        "Route handlers must not call the bare global fetch. Use '@/lib/egress.fetch' for URLs that come from a request, a model or a user's configuration, '@/lib/fetch' for a fixed destination, and open the file with `/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- <fixed vendor | self | operator storage> */` naming the destination class when the plain module is the right one.",
      noPlainFetch:
        "Route handlers must not import the plain fetch from '@/lib/fetch'. Use '@/lib/egress.fetch' for URLs that come from a request, a model or a user's configuration, or open the file with `/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- <fixed vendor | self | operator storage> */` naming the destination class.",
    },
  },

  create(context) {
    const filename = context.getFilename()

    if (!isRouteFile(filename)) {
      return {}
    }

    return {
      CallExpression(node) {
        if (isBareGlobalFetchCall(context, node)) {
          context.report({ node: node.callee, messageId: 'noGlobalFetch' })
        }
      },

      ImportDeclaration(node) {
        if (node.source.value !== '@/lib/fetch') {
          return
        }

        for (const specifier of node.specifiers) {
          const isDefault = specifier.type === 'ImportDefaultSpecifier'

          const isPlainNamed =
            specifier.type === 'ImportSpecifier' &&
            PLAIN_FETCH_EXPORTS.has(
              specifier.imported?.name ?? specifier.imported?.value
            )

          if (isDefault || isPlainNamed) {
            context.report({ node: specifier, messageId: 'noPlainFetch' })
          }
        }
      },
    }
  },
}
