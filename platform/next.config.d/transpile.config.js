// @ts-check
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// @note the packages the platform itself imports and therefore needs Next to
// compile from source. Only public names belong in this list - see
// `expandSwappedPackages` below for how the private half of a swappable module
// is picked up without naming it here.

const packages = [
  '@chatbotkit/fetch',
  '@chatbotkit/react',
  '@chatbotkit/sdk',
  '@chatbotkit/next',
  '@chatbotkit/widget',
  '@chatbotkit-dev/time',
  '@chatbotkit-dev/math',
  '@chatbotkit-dev/template',
  '@chatbotkit-dev/buffer',
  '@chatbotkit-dev/encoding',
  '@chatbotkit-dev/cloak',
  '@chatbotkit-dev/gpt',
  '@chatbotkit-dev/file',
  '@chatbotkit-dev/file-txt',
  '@chatbotkit-dev/file-md',
  '@chatbotkit-dev/file-html',
  '@chatbotkit-dev/file-csv',
  '@chatbotkit-dev/file-json',
  '@chatbotkit-dev/file-jsonl',
  '@chatbotkit-dev/file-yaml',
  '@chatbotkit-dev/file-pdf',
  '@chatbotkit-dev/file-docx',
  '@chatbotkit-dev/file-pptx',
  '@chatbotkit-dev/file-xlsx',
  '@chatbotkit-dev/sql',
  '@chatbotkit-dev/auxiliary-google-mail',
  '@chatbotkit-dev/auxiliary-google-docs',
  '@chatbotkit-dev/auxiliary-google-calendar',
  '@chatbotkit-dev/auxiliary-google-meet',
  '@chatbotkit-dev/auxiliary-microsoft-drive',
  '@chatbotkit-dev/auxiliary-microsoft-sharepoint',
  '@chatbotkit-dev/auxiliary-notion',
  '@chatbotkit-dev/billing',
  '@chatbotkit-dev/billing-spec',
  '@chatbotkit-dev/auxiliary-graphql',
  '@chatbotkit-dev/metascraper-font',
  '@chatbotkit-dev/typescript-utils',
  '@chatbotkit-dev/it',
  '@chatbotkit-dev/yaml',
  '@chatbotkit-dev/md',
  '@chatbotkit-dev/regex',
  '@chatbotkit-dev/path',
  '@chatbotkit-dev/env',
  '@chatbotkit-dev/struct',
  '@chatbotkit-dev/string',
  '@chatbotkit-dev/json',
  '@chatbotkit-dev/errors',
  '@chatbotkit-dev/blacklists',
  '@chatbotkit-dev/http-codes',
  '@chatbotkit-dev/debug',
  '@chatbotkit-dev/fetch',
  '@chatbotkit-dev/storage',
  '@chatbotkit-dev/storage-spec',
  '@chatbotkit-dev/memcache',
  '@chatbotkit-dev/memcache-spec',
  '@chatbotkit-dev/sandbox',
  '@chatbotkit-dev/sandbox-spec',
  '@chatbotkit-dev/batch',
  '@chatbotkit-dev/batch-spec',
  '@chatbotkit-dev/vector',
  '@chatbotkit-dev/vector-spec',
  '@chatbotkit-dev/queue',
  '@chatbotkit-dev/queue-spec',
  '@chatbotkit-dev/db',
  '@chatbotkit-dev/db-spec',
  '@chatbotkit-dev/relay',
  '@chatbotkit-dev/relay-spec',
  '@chatbotkit-dev/screenshot',
  '@chatbotkit-dev/screenshot-spec',
  '@chatbotkit-dev/respond',
  '@chatbotkit-dev/respond-spec',
  '@chatbotkit-dev/partners',
  '@chatbotkit-dev/partners-spec',
  '@chatbotkit-dev/script',
  '@chatbotkit-dev/email',
  '@chatbotkit-dev/email-spec',
  '@chatbotkit-dev/observability',
  '@chatbotkit-dev/observability-spec',
  '@chatbotkit-dev/pii',
  '@chatbotkit-dev/pii-spec',
  '@chatbotkit-dev/searchengine',
  '@chatbotkit-dev/searchengine-spec',
  '@chatbotkit-dev/secrets-platform',
  '@chatbotkit-dev/secrets-platform-spec',
  'react-prompt-kit',
  'mcp-widgets',
]

// @note ESM-only npm packages. Left out of this list they externalize as async
// `import()` modules in the pages-router server build (esmExternals:false only
// restores `require()` for dual packages), and async modules inside the
// engine's import cycles end up consumed before they finish initializing -
// see bundling.config.js

const esmOnlyPackages = [
  '@toon-format/toon',
  'email-reply-parser',
  'file-type',
  'graphql-request',
  'mdast-util-to-string',
  'mermaid',
  'mime',
  'parse-domain',
  'react-markdown',
  'rehype-katex',
  'rehype-raw',
  'rehype-slug',
  'rehype-stringify',
  'remark-gfm',
  'remark-math',
  'remark-parse',
  'remark-rehype',
  'shiki',
  'unified',
  'unist-util-visit',
]

/**
 * Read the manifest of `request` as installed relative to `from`, walking up
 * the directory tree the way Node's resolver does.
 *
 * @note we read `node_modules/<request>/package.json` off disk rather than
 * going through `require.resolve` because these packages ship source-only
 * `exports` maps that a CJS resolve cannot always satisfy.
 *
 * @param {string} request
 * @param {string} from
 * @returns {{ dir: string, manifest: any } | null}
 */
function readManifest(request, from) {
  for (let dir = from; ; ) {
    const file = path.join(dir, 'node_modules', request, 'package.json')

    if (fs.existsSync(file)) {
      // @note resolve the symlink before handing the directory to the caller:
      // under `pnpm deploy` a package's same-scope dependencies live as
      // siblings in the `.pnpm` virtual store, which the upward walk can only
      // reach from the package's real path - walking up from the symlink path
      // silently drops them from the transpile list
      return {
        dir: fs.realpathSync(path.dirname(file)),
        manifest: JSON.parse(fs.readFileSync(file, 'utf8')),
      }
    }

    const parent = path.dirname(dir)

    if (parent === dir) {
      // @note not installed here - nothing to transpile, and Next ignores
      // entries that never match a resolved package anyway
      return null
    }

    dir = parent
  }
}

/**
 * Collect the names a request actually resolves to when the resolved package is
 * not the one that was asked for.
 *
 * @note a swappable module is imported as `@chatbotkit-dev/<name>` but an
 * override can resolve it to a package with a different name, and
 * `transpilePackages` matches the resolved package's own name. Ask the
 * installed tree what each public name became instead of hard-coding possible
 * implementations. Once inside a swapped package, also follow dependencies in
 * that package's scope because they may not appear in a public manifest.
 *
 * @param {string} request
 * @param {string} from
 * @param {Set<string>} out
 * @param {Set<string>} seen
 * @param {boolean} swapped
 * @returns {void}
 */
function expandSwappedPackages(request, from, out, seen, swapped) {
  const key = `${from}:${request}`

  if (seen.has(key)) {
    return
  }

  seen.add(key)

  const found = readManifest(request, from)

  if (!found) {
    return
  }

  const { dir, manifest } = found

  const name = String(manifest.name)

  if (!swapped && name === request) {
    // @note resolved to itself, so the public name already covers it
    return
  }

  out.add(name)

  // @note an unscoped package has no sibling scope to follow
  if (!name.startsWith('@') || !name.includes('/')) {
    return
  }

  const scope = name.slice(0, name.indexOf('/'))

  for (const dependency of Object.keys(manifest.dependencies || {})) {
    if (dependency.startsWith(`${scope}/`)) {
      expandSwappedPackages(dependency, dir, out, seen, true)
    }
  }
}

/**
 * @param {{ report?: boolean }} [options]
 * @returns {string[]}
 */
export function resolveTranspilePackages({ report = true } = {}) {
  const out = new Set()
  const seen = new Set()

  const from = path.join(__dirname, '..')

  for (const request of packages) {
    expandSwappedPackages(request, from, out, seen, false)
  }

  if (report) {
    // @note print the expansion so a build that resolves a swap differently -
    // or fails to resolve one at all - is visible in the log rather than only
    // in whatever fails to compile later on
    // eslint-disable-next-line no-console
    console.log(
      `[transpile.config.js] resolved ${out.size} swapped package(s): ${
        [...out].join(', ') || 'none'
      }`
    )
  }

  return [...packages, ...esmOnlyPackages, ...out]
}

/** @type {import('next').NextConfig} */
export default {
  // @note see the jest.utest.config.js jest.itest.config.js for explanation of
  // why we need to conditionally transpile these packages depending on the
  // environment

  transpilePackages:
    process.env.NODE_ENV === 'test' ? [] : resolveTranspilePackages(),
}
