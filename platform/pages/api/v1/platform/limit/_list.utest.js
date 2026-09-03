import handler from './list'

import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/config/limits', () => ({
  __esModule: true,
  default: {
    free: {
      conversationTokens: 1000,
      requests: 100,
    },
    basic: {
      conversationTokens: 10000,
      requests: 1000,
    },
    pro: {
      conversationTokens: 100000,
      requests: 10000,
    },
  },
}))

describe('/api/v1/platform/limit/list', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return limits configuration', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const response = await handler(req)

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data).toBeDefined()
      expect(typeof data).toBe('object')
    })

    it('should return limits from config', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const response = await handler(req)

      const data = await response.json()

      expect(data).toHaveProperty('free')
      expect(data).toHaveProperty('basic')
      expect(data).toHaveProperty('pro')
    })
  })

  describe('response structure', () => {
    it('should have expected limit tiers', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const response = await handler(req)

      const data = await response.json()

      expect(data.free).toBeDefined()
      expect(data.basic).toBeDefined()
      expect(data.pro).toBeDefined()
    })

    it('should return limit values for each tier', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const response = await handler(req)

      const data = await response.json()

      expect(data.free.conversationTokens).toBe(1000)
      expect(data.free.requests).toBe(100)
      expect(data.basic.conversationTokens).toBe(10000)
      expect(data.basic.requests).toBe(1000)
    })
  })

  describe('edge cases', () => {
    it('should work with empty query parameters', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)

      expect(response.status).toBe(200)
    })

    it('should ignore request body', async () => {
      const { req } = createMocks({
        method: 'GET',
        body: { someData: 'ignored' },
      })

      const response = await handler(req)

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data).toHaveProperty('free')
    })
  })

  describe('consistency', () => {
    it('should return same limits across multiple calls', async () => {
      const results = []

      for (let i = 0; i < 3; i++) {
        const { req } = createMocks({
          method: 'GET',
        })

        const response = await handler(req)
        const data = await response.json()

        results.push(data)
      }

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(results[1])
      expect(results[1]).toEqual(results[2])
    })
  })
})
