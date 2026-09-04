// @ts-check

/** @type {import('next').NextConfig} */
export default {
  // @note the pages-router server build externalizes ESM deps as `import()`,
  // turning the module graph async; import cycles then leave modules (e.g.
  // lib/debug) permanently uninitialized in the standalone server. Forcing CJS
  // externals restores sync `require()` for dual packages (zod et al) and
  // bundles ESM-only ones.
  experimental: {
    esmExternals: false,
  },

  // Remove some packages from the server bundle

  serverExternalPackages: [
    '@supabase/sql-to-rest',
    '@napi-rs/canvas',
    'libpg-query',
    '@duckdb/node-api',
    '@prisma/client',
    'better-sqlite3',
    // @note the egress boundary's dispatcher (lib/egress.ts); left external
    // so Node's global fetch receives undici's own Agent class
    'undici',
    // @note spawns its native sidecar and resolves its command packages
    // against its own package directory; bundling it strands those as
    // relative import() externals
    '@rivet-dev/agentos-core',
  ],

  // @note include Prisma client files (including WASM) in Vercel serverless functions
  // @see https://github.com/prisma/prisma/issues/27754
  // @note the sandbox runtime's native sidecar, WebAssembly commands and
  // command packages are read from disk at run time rather than required, so
  // file tracing cannot see them; the standalone build carries each package
  // directory whole, manifest included, so the copies resolve. The runtime
  // package itself is left to the trace on purpose: globbing its store
  // directory copies its sibling links as flattened files, and the sidecar
  // link copied that way can no longer find its platform binary package
  outputFileTracingIncludes: {
    '/api/**/*': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*',
      '../node_modules/.pnpm/@rivet-dev+agentos-sidecar*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@rivet-dev+agentos-runtime-*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@agentos-software+*/node_modules/@agentos-software/**/*',
    ],
    '/*': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*',
      '../node_modules/.pnpm/@rivet-dev+agentos-sidecar*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@rivet-dev+agentos-runtime-*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@agentos-software+*/node_modules/@agentos-software/**/*',
    ],
  },

  // @note better-sqlite3 is a native addon: when webpack bundles its JS, the
  // binding lookup walks from the bundle's location instead of the package
  // and never finds better_sqlite3.node. The list above externalizes it for
  // the app router only, so the pages-router server compile externalizes it
  // here. Edge stays untouched - there is no native addon on edge either way.
  webpack(config, options) {
    if (options.isServer && options.nextRuntime !== 'edge') {
      config.externals.push({ 'better-sqlite3': 'commonjs better-sqlite3' })
      // @note ws probes its optional native addons inside a try/catch and
      // falls back to pure JS only when the require throws. Webpack replaces
      // the uninstalled packages with empty modules instead, so ws wires
      // `{}.unmask` / `{}(buf)` and every masked frame over 32 bytes (audio
      // streaming) crashes the process. Externalizing keeps the require real.
      config.externals.push({
        bufferutil: 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      })
      // @note no mirror for @rivet-dev/agentos-core: it is ESM-only, so the
      // list above externalizes it as an import() the sandbox module awaits
      // lazily - allowed by name in scripts/verify-bundle-modules.js
    }

    return config
  },
}
