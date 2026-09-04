import config from './bundling.agentos.config'

describe('bundling.agentos.config', () => {
  it('externalizes the sandbox runtime on the server', () => {
    expect(config.serverExternalPackages).toEqual(['@rivet-dev/agentos-core'])
  })

  it.each(Object.entries(config.outputFileTracingIncludes))(
    'traces each AgentOS package through one store directory for %s',
    (_, patterns) => {
      expect(patterns).toEqual([
        '../node_modules/.pnpm/@rivet-dev+agentos-sidecar@*/node_modules/@rivet-dev/**/*',
        '../node_modules/.pnpm/@agentos-software+common@*/node_modules/@agentos-software/**/*',
      ])

      // @note a `+name*` or `+*` store glob also matches the platform binary
      // and command packages by their own directories, shipping every
      // binary a second time; the `@*` anchor pins each glob to one package
      for (const pattern of patterns) {
        expect(pattern).toMatch(/\.pnpm\/@[^/]+@\*\//)
      }
    }
  )
})
