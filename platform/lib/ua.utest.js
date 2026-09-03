import { getRandomUserAgent } from './ua'

describe('getRandomUserAgent', () => {
  describe('basic functionality', () => {
    it('should return a valid user agent string', () => {
      const userAgent = getRandomUserAgent()

      expect(userAgent).toBeDefined()
      expect(typeof userAgent).toBe('string')
      expect(userAgent.length).toBeGreaterThan(0)
    })

    it('should return a user agent containing browser information', () => {
      const userAgent = getRandomUserAgent()

      expect(userAgent).toContain('Mozilla')
      expect(userAgent).toContain('AppleWebKit')
      expect(userAgent).toContain('Chrome')
      expect(userAgent).toContain('Safari')
    })

    it('should return a user agent containing OS information', () => {
      const userAgent = getRandomUserAgent()

      expect(userAgent).toContain('Macintosh')
      expect(userAgent).toContain('Intel Mac OS X')
    })
  })

  describe('consistency', () => {
    it('should return the same user agent string on multiple calls', () => {
      const userAgent1 = getRandomUserAgent()
      const userAgent2 = getRandomUserAgent()

      expect(userAgent1).toBe(userAgent2)
    })
  })

  describe('format validation', () => {
    it('should return a user agent matching the expected format', () => {
      const userAgent = getRandomUserAgent()

      const userAgentPattern =
        /^Mozilla\/[\d.]+ \(.+\) AppleWebKit\/[\d.]+ \(.+\) Chrome\/[\d.]+ Safari\/[\d.]+$/

      expect(userAgent).toMatch(userAgentPattern)
    })
  })
})
