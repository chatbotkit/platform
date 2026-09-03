import fetch from '@/lib/fetch'

describe('Status API Integration Tests', () => {
  const paths = ['/api/v1/status/ping', '/api/system/status/ping']

  paths.forEach((path) => {
    it(`should return 200 and status "ok" for ${path}`, async () => {
      const response = await fetch(
        new URL(path, process.env._ITEST_CHATBOTKIT_BASE_URL).href
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('ok')
    })
  })
})
