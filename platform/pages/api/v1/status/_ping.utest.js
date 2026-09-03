import handler from './ping'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('GET /api/v1/status/ping', () => {
  describe('basic functionality', () => {
    it('should return ok status', async () => {
      const result = await handler({})

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })

    it('should handle requests without query parameters', async () => {
      const result = await handler({ query: {} })

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })

    it('should return status ok', async () => {
      const result = await handler({})

      expect(result.body.status).toBe('ok')
    })
  })

  describe('response format', () => {
    it('should return valid response', async () => {
      const result = await handler({})

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.status).toBe(200)
      expect(result.body.status).toBe('ok')
    })

    it('should have status property in body', async () => {
      const result = await handler({})

      expect(result.body).toHaveProperty('status')
    })

    it('should return only status property in body', async () => {
      const result = await handler({})

      expect(Object.keys(result.body)).toEqual(['status'])
    })
  })

  describe('edge cases', () => {
    it('should handle repeated calls consistently', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await handler({})

        expect(result).toEqual({ status: 200, body: { status: 'ok' } })
      }
    })

    it('should ignore request body', async () => {
      const result = await handler({ body: { foo: 'bar' } })

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })

    it('should ignore request headers', async () => {
      const result = await handler({
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'value',
        },
      })

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })

    it('should handle null request', async () => {
      const result = await handler(null)

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })

    it('should handle undefined request', async () => {
      const result = await handler(undefined)

      expect(result).toEqual({ status: 200, body: { status: 'ok' } })
    })
  })
})
