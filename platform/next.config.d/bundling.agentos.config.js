// @ts-check

// The sandbox module's runtime, AgentOS (@rivet-dev/agentos-core), is the one
// dependency whose files the bundler can neither bundle nor trace, so its
// bundling rules live here rather than in bundling.config.js.

/** @type {import('next').NextConfig} */
export default {
  // @note spawns its native sidecar and resolves its command packages
  // against its own package directory; bundling it strands those as
  // relative import() externals. It is ESM-only, so this externalizes it as
  // an import() the sandbox module awaits lazily - allowed by name in
  // scripts/verify-bundle-modules.js - and there is no commonjs mirror in
  // bundling.config.js's webpack hook for it
  serverExternalPackages: ['@rivet-dev/agentos-core'],

  // @note the native sidecar and command packages are read from disk at run
  // time rather than required, so file tracing cannot see them. Only the
  // store directory Node resolves through is globbed: the glob follows
  // pnpm's sibling links, so the sidecar meta package carries a flattened
  // copy of its platform binary and @agentos-software/common one of each
  // command package. Matching the platform and command packages by their own
  // store directories ships every binary twice (~500 MB) that nothing links
  // to. The runtime package itself is left to the trace, and its native
  // sidecar and commands directory are not shipped at all - the core package
  // resolves neither at this version
  outputFileTracingIncludes: {
    '/api/**/*': [
      '../node_modules/.pnpm/@rivet-dev+agentos-sidecar@*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@agentos-software+common@*/node_modules/@agentos-software/**/*',
    ],
    '/*': [
      '../node_modules/.pnpm/@rivet-dev+agentos-sidecar@*/node_modules/@rivet-dev/**/*',
      '../node_modules/.pnpm/@agentos-software+common@*/node_modules/@agentos-software/**/*',
    ],
  },
}
