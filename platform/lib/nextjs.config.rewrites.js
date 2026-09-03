// @ts-check

// DO NOT CONVERT TO TYPESCRIPT - Used by Next.js config which runs in Node without transpilation

/**
 * @typedef {Object} DoNotProxyOptions
 * @property {boolean} [api] - Whether to not proxy API routes
 * @property {boolean} [oauth] - Whether to not proxy OAuth routes
 */

/**
 * @typedef {Object} BuildCaptureAllSourceOptions
 * @property {string[]} [excludes] - Custom paths to exclude
 * @property {string[]} [allowedExtensions] - Allowed file extensions
 * @property {string[]} [standardExcludes] - Standard exclusion patterns
 * @property {DoNotProxyOptions} [doNotProxy] - Proxy exclusion configuration
 */

/**
 * Builds a Next.js rewrite pattern that captures all paths except specified exclusions.
 *
 * @param {BuildCaptureAllSourceOptions} [options] - Configuration options for building the capture pattern
 * @returns {string} A Next.js rewrite pattern string in the format `/:path(...)`
 * @todo put outside
 */
export function buildCaptureAllSource(options = {}) {
  /** @type {string[]} */
  const allExcludes = []

  {
    if (Array.isArray(options.excludes)) {
      allExcludes.push(...options.excludes)
    }

    const allowedExtensions = options.allowedExtensions || [
      // @todo enum the public folder for the complete list

      'jpg',
      'jpeg',
      'png',
      'gif',
      'svg',
      'ico',
      'js',
      'css',
      'ttf',
      'woff',
      'woff2',

      // @note this files is automatically generated with routes
      // 'webmanifest',
    ]

    const standardExcludes = options.standardExcludes || [
      // @note Next.js assets and API routes

      '_next',

      // @note omit API and OAuth routes by default since they are commonly used

      ...(options.doNotProxy?.api ? [] : ['api']),
      ...(options.doNotProxy?.oauth ? [] : ['oauth\\/']),

      // @note sentry monitoring tunnel

      'monitoring-tunnel',

      // @note common public files and paths

      's\\/',
      '.*\\/icon',

      // @note partner assets

      'partner',

      // @note common files that portals may want to serve from the public root

      ...(allowedExtensions.length
        ? [`.*\\.(?:${allowedExtensions.join('|')})`]
        : []),
    ]

    allExcludes.push(...standardExcludes)
  }

  const exPattern = allExcludes.length > 0 ? `(?!${allExcludes.join('|')})` : ''

  return `/:path(${exPattern}.*)`
}

/** @param {string} value */
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A host-matching regex source for a set of hosts, or undefined when the set
 * is empty.
 *
 * @param {string[]} hosts
 * @param {string} group - the named capture group to bind the match to
 */
export function buildHostPattern(hosts, group) {
  if (!hosts.length) {
    return undefined
  }

  return `(?<${group}>${hosts.map(escapeRegex).join('|')})`
}
