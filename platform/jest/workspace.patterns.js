import { resolveTranspilePackages } from '../next.config.d/transpile.config.js'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Creates Jest transform allowlist patterns for workspace packages and any
 * deployment-specific packages installed over their public names.
 *
 * @returns {string[]}
 */
export function getWorkspacePatterns() {
  const publicScopes = ['@chatbotkit-dev/', '@chatbotkit/']

  const replacementPatterns = resolveTranspilePackages({ report: false })
    .filter((name) => !publicScopes.some((scope) => name.startsWith(scope)))
    .flatMap((name) => {
      const packageName = escapeRegExp(name)
      const pnpmName = escapeRegExp(name.replace('/', '+'))

      return [packageName, `\\.pnpm/${pnpmName}@.+?`]
    })

  return [
    '@chatbotkit-dev/.+?',
    '@chatbotkit/.+?',
    '\\.pnpm/@chatbotkit-dev\\+.+?',
    '\\.pnpm/@chatbotkit\\+.+?',
    ...replacementPatterns,
  ]
}
