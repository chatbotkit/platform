/* eslint-disable @typescript-eslint/no-require-imports */
// @note shared by `require-transpiled-package`: the two questions the rule
// asks the disk - "does this package ship TypeScript source?" and "is it in
// the `packages` array of next.config.d/transpile.config.js?" - each cached
// per process because lint visits thousands of files.

const fs = require('fs')
const path = require('path')

const TRANSPILE_CONFIG = 'next.config.d/transpile.config.js'

const BUILTINS = new Set(
  (() => {
    try {
      return require('module').builtinModules
    } catch {
      return []
    }
  })()
)

/**
 * Extract the bare package name from an import specifier, or null when the
 * specifier is not a bare package (relative, absolute, alias or builtin).
 *
 * @param {string} source
 * @returns {string | null}
 */
function packageNameOf(source) {
  if (typeof source !== 'string' || source.length === 0) {
    return null
  }

  if (
    source.startsWith('.') ||
    source.startsWith('/') ||
    source.startsWith('@/') ||
    source.startsWith('~/') ||
    source.startsWith('node:') ||
    source.startsWith('data:') ||
    source.startsWith('http:') ||
    source.startsWith('https:')
  ) {
    return null
  }

  const parts = source.split('/')

  const name = source.startsWith('@')
    ? parts.length >= 2
      ? `${parts[0]}/${parts[1]}`
      : null
    : parts[0]

  if (!name || BUILTINS.has(name)) {
    return null
  }

  return name
}

/**
 * The `exports` subpath a specifier asks for: `.` or `./rest`.
 *
 * @param {string} source
 * @param {string} name
 * @returns {string}
 */
function subpathOf(source, name) {
  const rest = source.slice(name.length)

  return rest ? `.${rest}` : '.'
}

const TS_SOURCE_PATTERN = /\.[cm]?tsx?$/
const TS_DECLARATION_PATTERN = /\.d\.[cm]?ts$/

function isTsSource(target) {
  return (
    typeof target === 'string' &&
    TS_SOURCE_PATTERN.test(target) &&
    !TS_DECLARATION_PATTERN.test(target)
  )
}

// @note the conditions webpack/Next actually resolve; `types`, `source` and
// custom conditions (zod's `@zod/source`, eventsource-parser's `source`) are
// never followed by the build, so a `.ts` target under one of those does not
// make a package source-only. Subpath keys (`.`, `./x`) are always followed.
const RESOLVED_CONDITIONS = new Set([
  'import',
  'require',
  'default',
  'node',
  'browser',
  'module',
  'worker',
  'react-server',
  'edge-light',
])

/**
 * Walk an `exports` map collecting every target reachable through a condition
 * the bundler resolves.
 *
 * @param {unknown} value
 * @param {string[]} out
 */
function collectExportTargets(value, out) {
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectExportTargets(item, out)
    }
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!(key.startsWith('.') || RESOLVED_CONDITIONS.has(key))) {
        continue
      }

      collectExportTargets(item, out)
    }
  }
}

/**
 * Pick the `exports` entry Node/webpack would use for `subpath` (`.` or
 * `./x/y`), honouring `*` patterns; undefined when nothing matches.
 *
 * @param {unknown} exportsField
 * @param {string} subpath
 * @returns {unknown}
 */
function selectExportEntry(exportsField, subpath) {
  if (exportsField === undefined || exportsField === null) {
    return undefined
  }

  const isSubpathMap =
    exportsField &&
    typeof exportsField === 'object' &&
    !Array.isArray(exportsField) &&
    Object.keys(exportsField).some((key) => key.startsWith('.'))

  if (!isSubpathMap) {
    // @note a bare string / array / conditions object describes the root
    return subpath === '.' ? exportsField : undefined
  }

  if (Object.prototype.hasOwnProperty.call(exportsField, subpath)) {
    return exportsField[subpath]
  }

  let best

  for (const key of Object.keys(exportsField)) {
    const star = key.indexOf('*')

    if (star === -1) {
      continue
    }

    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)

    if (
      subpath.length >= prefix.length + suffix.length &&
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix) &&
      (!best || prefix.length > best.prefix.length)
    ) {
      best = { prefix, value: exportsField[key] }
    }
  }

  return best ? best.value : undefined
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} [subpath] `.` for the package root, `./x` for a subpath
 * @returns {boolean}
 */
function isSourceOnlyManifest(manifest, subpath = '.') {
  if (!manifest || typeof manifest !== 'object') {
    return false
  }

  const targets = []

  collectExportTargets(selectExportEntry(manifest.exports, subpath), targets)

  if (targets.length > 0) {
    return targets.some(isTsSource)
  }

  if (subpath !== '.') {
    // @note no matching export: the build resolves the file path directly,
    // so a `.ts` suffix in the request is the only tell
    return isTsSource(subpath)
  }

  return isTsSource(manifest.main) || isTsSource(manifest.module)
}

/**
 * Read `node_modules/<name>/package.json` walking up from `from` like Node.
 *
 * @param {string} name
 * @param {string} from
 * @returns {Record<string, unknown> | null}
 */
function readManifest(name, from) {
  for (let dir = from; ; ) {
    const file = path.join(dir, 'node_modules', name, 'package.json')

    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
      }
    } catch {
      return null
    }

    const parent = path.dirname(dir)

    if (parent === dir) {
      return null
    }

    dir = parent
  }
}

/**
 * Parse the `const packages = [ ... ]` block out of the transpile config text
 * without importing the ESM module.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function parseTranspiledPackages(text) {
  const match = /const\s+packages\s*=\s*\[([\s\S]*?)\]/.exec(text)

  if (!match) {
    return new Set()
  }

  const names = new Set()

  for (const quoted of match[1].matchAll(/(['"`])([^'"`]+)\1/g)) {
    names.add(quoted[2])
  }

  return names
}

const manifestCache = new Map()
const sourceOnlyCache = new Map()
const transpiledCache = new Map()

/**
 * @param {string} root the lint cwd (the app root)
 * @returns {{ isSourceOnly(name: string): boolean, isTranspiled(name: string): boolean }}
 */
function createDiskResolver(root) {
  return {
    isSourceOnly(name, subpath = '.') {
      const key = `${root}:${name}:${subpath}`

      if (!sourceOnlyCache.has(key)) {
        const manifestKey = `${root}:${name}`

        if (!manifestCache.has(manifestKey)) {
          manifestCache.set(manifestKey, readManifest(name, root))
        }

        sourceOnlyCache.set(
          key,
          isSourceOnlyManifest(manifestCache.get(manifestKey), subpath)
        )
      }

      return sourceOnlyCache.get(key)
    },

    isTranspiled(name) {
      if (!transpiledCache.has(root)) {
        let names = new Set()

        try {
          names = parseTranspiledPackages(
            fs.readFileSync(path.join(root, TRANSPILE_CONFIG), 'utf8')
          )
        } catch {
          // @note no config here (linting outside the app) - nothing to
          // compare against, so nothing is reported
        }

        transpiledCache.set(root, names)
      }

      return transpiledCache.get(root).has(name)
    },
  }
}

/**
 * @param {{ transpiled?: string[], sourceOnly?: string[] }} options
 */
function createStaticResolver(options) {
  const transpiled = new Set(options.transpiled || [])
  const sourceOnly = new Set(options.sourceOnly || [])

  return {
    isSourceOnly: (name) => sourceOnly.has(name),
    isTranspiled: (name) => transpiled.has(name),
  }
}

module.exports = {
  TRANSPILE_CONFIG,
  packageNameOf,
  subpathOf,
  selectExportEntry,
  isSourceOnlyManifest,
  parseTranspiledPackages,
  createDiskResolver,
  createStaticResolver,
}
