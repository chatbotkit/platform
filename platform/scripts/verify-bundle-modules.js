import { error, log } from '@/lib/debug'

import fs from 'node:fs'
import path from 'node:path'

// @note guards the invariant that the pages-router server build contains no
// async webpack modules: ESM deps externalized as `import()` become
// top-level-await modules, and inside the engine's import cycles those are
// consumed before they finish initializing - but only in the standalone
// server, where all routes share one module registry (Vercel's per-route
// isolation masks it). See next.config.d/bundling.config.js and the
// esmOnlyPackages list in next.config.d/transpile.config.js.

// @note intentional top-level await must be exempted here explicitly - one
// entry per known async module occurrence, so new ones fail the build until
// someone decides they are safe.
const allowedAsyncModuleFiles = []

// @note import() externals that are safe because every consumer awaits them
// at the call site (lazy loads), so they never become top-level-await modules
// inside the engine's import cycles. The Prisma 7 client engine lazy-loads
// its wasm query compiler this way (generated internal/class.ts), and
// @prisma/client cannot be bundled instead - it is in serverExternalPackages,
// which Next forbids combining with transpilePackages.
const allowedExternalSpecifiers = [
  '@prisma/client/runtime/query_compiler_fast_bg.mysql.mjs',
  '@prisma/client/runtime/query_compiler_fast_bg.mysql.wasm-base64.mjs',
  // @note the sandbox runtime is ESM-only and cannot be bundled - it spawns a
  // native sidecar and resolves its command packages against its own
  // directory - and the sandbox module imports it lazily inside a function,
  // awaited at every call site, never at module scope
  '@rivet-dev/agentos-core',
]

const EXTERNAL_RE = /\b[a-zA-Z_$][\w$]*\.exports\s*=\s*import\("([^"]+)"\)/g

const ASYNC_MODULE_RE =
  /\b[a-zA-Z_$][\w$]*\.a\([a-zA-Z_$][\w$]*,\s*async\([a-zA-Z_$][\w$]*,[a-zA-Z_$][\w$]*\)=>\{try\{/g

const serverDir = path.resolve(process.argv[2] || '.next/server')

if (!fs.existsSync(serverDir)) {
  error(`[verify-bundle-modules] missing directory: ${serverDir}`)

  process.exit(1)
}

/** @type {Map<string, Set<string>>} */
const externals = new Map()

/** @type {Map<string, number>} */
const asyncModules = new Map()

for (const entry of fs.readdirSync(serverDir, {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) {
    continue
  }

  const filePath = path.join(entry.parentPath, entry.name)
  const relPath = path.relative(serverDir, filePath)
  const source = fs.readFileSync(filePath, 'utf8')

  for (const match of source.matchAll(EXTERNAL_RE)) {
    const specifier = match[1]

    if (allowedExternalSpecifiers.includes(specifier)) {
      continue
    }

    // @note relative specifiers are a package importing its own files at
    // runtime; they surface here as well because bundling half a package
    // breaks the other half - fix by externalizing or fully bundling it
    if (!externals.has(specifier)) {
      externals.set(specifier, new Set())
    }

    externals.get(specifier).add(relPath)
  }

  const asyncCount = [...source.matchAll(ASYNC_MODULE_RE)].length

  if (asyncCount > 0 && !allowedAsyncModuleFiles.includes(relPath)) {
    asyncModules.set(relPath, asyncCount)
  }
}

if (externals.size === 0 && asyncModules.size === 0) {
  log(
    `[verify-bundle-modules] ok: no import() externals or async modules in ${serverDir}`
  )

  process.exit(0)
}

if (externals.size > 0) {
  error(
    '[verify-bundle-modules] ESM import() externals found - add each package to esmOnlyPackages in next.config.d/transpile.config.js:'
  )

  for (const [specifier, files] of [...externals].sort()) {
    error(`  ${specifier} (${files.size} file(s), e.g. ${[...files][0]})`)
  }
}

if (asyncModules.size > 0) {
  error(
    '[verify-bundle-modules] async webpack modules found (top-level await or a missed ESM external):'
  )

  for (const [file, count] of [...asyncModules].sort()) {
    error(`  ${file} (${count} module(s))`)
  }
}

process.exit(1)
