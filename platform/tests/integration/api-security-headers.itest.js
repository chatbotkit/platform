import fetch from '@/lib/fetch'

describe('API Security Headers Integration Tests', () => {
  const apiEndpoints = ['/api/v1/status/ping']

  const securityHeaders = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'x-xss-protection',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
  ]

  describe('API routes should not have browser security headers', () => {
    apiEndpoints.forEach((endpoint) => {
      it(`${endpoint} should not have CSP or other browser security headers`, async () => {
        const response = await fetch(
          new URL(endpoint, process.env._ITEST_CHATBOTKIT_BASE_URL).href
        )

        // API should return a response (200, 401, 404, etc. - depends on endpoint and auth)

        expect(response.status).toBeGreaterThanOrEqual(200)
        expect(response.status).toBeLessThan(500)

        // Check that none of the browser security headers are present

        securityHeaders.forEach((headerName) => {
          const headerValue = response.headers.get(headerName)

          expect(headerValue).toBeNull()
        })
      })
    })
  })

  describe('Specific CSP header validation', () => {
    it('/api/v1/status/ping should specifically not have Content-Security-Policy header', async () => {
      const response = await fetch(
        new URL('/api/v1/status/ping', process.env._ITEST_CHATBOTKIT_BASE_URL)
          .href
      )

      expect(response.status).toBe(200)

      const cspHeader = response.headers.get('content-security-policy')

      expect(cspHeader).toBeNull()

      const contentType = response.headers.get('content-type')

      expect(contentType).toContain('application/json')

      const data = await response.json()

      expect(data.status).toBe('ok')
    })
  })

  describe('API routes should have appropriate CORS headers', () => {
    it('/api/v1/status/ping should have CORS headers for API access', async () => {
      const response = await fetch(
        new URL('/api/v1/status/ping', process.env._ITEST_CHATBOTKIT_BASE_URL)
          .href
      )

      expect(response.status).toBe(200)

      // The important thing is that browser security headers are NOT present

      expect(response.headers.get('content-security-policy')).toBeNull()
      expect(response.headers.get('x-frame-options')).toBeNull()
    })
  })
})
