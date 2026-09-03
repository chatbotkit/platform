import securityConfig from './security.config'

describe('Security Config - configToHeaders function', () => {
  let headerRules

  beforeAll(async () => {
    headerRules = await securityConfig.headers()
  })

  // @note we are not setting any headers for embeddable paths for now to avoid
  // breaking any integrations that rely on iframes
  describe.skip('Integration with EMBEDDABLE_PATHS', () => {
    it.each([
      ['/integrations/widget/v1.js'],
      ['/integrations/widget/v2.js'],
      ['/integrations/widget/plugins/plugin1.js'],
      ['/integrations/widget/plugins/plugin2.js'],
      ['/integrations/widget/abc/frame'],
      ['/integrations/widget/abc/frame?xyz=123'],
    ])('should match an embeddable path %s', (path) => {
      const match = headerRules.find((rule) =>
        path.match(new RegExp('^/' + rule.source.slice('/:path'.length)))
      )

      expect(match).toBeDefined()

      const xFrameOptions = match.headers.find(
        (h) => h.key === 'X-Frame-Options'
      )

      expect(xFrameOptions).toBeUndefined()
    })

    it.each([
      ['/'],
      ['/random/path'],
      ['/bots'],
      ['/integration/widget'],
      ['/integration/widget/test123'],
      ['/integration/widget/test123/test'],
    ])('should not match an embeddable path %s', (path) => {
      const match = headerRules.find((rule) =>
        path.match(new RegExp('^/' + rule.source.slice('/:path'.length)))
      )

      expect(match).toBeDefined()

      const xFrameOptions = match.headers.find(
        (h) => h.key === 'X-Frame-Options'
      )

      expect(xFrameOptions).toBeDefined()
    })
  })
})
