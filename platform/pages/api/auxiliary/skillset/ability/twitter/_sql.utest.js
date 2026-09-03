/* eslint-disable @typescript-eslint/no-require-imports */

// @note mock auxiliary.handler to expose the inner function directly
jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    return (parameters, headers) => fn({ user: { id: 'test-user-id' } }, parameters, headers)
  }),
}))

// @note mock the call module before importing anything that uses it
jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

const mockCall = require('@/lib/call').default

async function loadHandler() {
  const { default: handler } = await import(
    '@/pages/api/auxiliary/skillset/ability/twitter/sql'
  )

  return handler
}

function headersWithToken(token = 'Bearer test-token') {
  const headers = new Headers()

  headers.set('x-access-token', token)

  return headers
}

describe('X (Twitter) SQL Handler - API Serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('tweets SELECT', () => {
    it('should serialize SELECT WHERE id to the post lookup endpoint', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: '123',
              text: 'hello',
              public_metrics: { like_count: 5 },
            },
          }),
      })

      const handler = await loadHandler()

      const result = await handler(
        { sql: "SELECT * FROM twitter.tweets WHERE id = '123'" },
        headersWithToken()
      )

      expect(mockCall.mock.calls[0][0]).toMatch(
        /^https:\/\/api\.x\.com\/2\/tweets\/123\?/
      )
      expect(result.result[0].row).toEqual(
        expect.objectContaining({ id: '123', text: 'hello', like_count: 5 })
      )
    })

    it('should serialize SELECT WHERE query to the recent search endpoint', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: '1' }, { id: '2' }] }),
      })

      const handler = await loadHandler()

      await handler(
        {
          sql: "SELECT * FROM twitter.tweets WHERE query = 'from:nasa -is:retweet'",
        },
        headersWithToken()
      )

      const url = mockCall.mock.calls[0][0]

      expect(url).toMatch(/^https:\/\/api\.x\.com\/2\/tweets\/search\/recent\?/)
      expect(url).toContain('query=from%3Anasa')
    })

    it('should serialize SELECT WHERE author_id to the user timeline endpoint', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: '9' }] }),
      })

      const handler = await loadHandler()

      await handler(
        { sql: "SELECT * FROM twitter.tweets WHERE author_id = '55'" },
        headersWithToken()
      )

      expect(mockCall.mock.calls[0][0]).toMatch(
        /^https:\/\/api\.x\.com\/2\/users\/55\/tweets\?/
      )
    })

    it('should reject SELECT without a supported WHERE clause', async () => {
      const handler = await loadHandler()

      await expect(
        handler({ sql: 'SELECT * FROM twitter.tweets' }, headersWithToken())
      ).rejects.toThrow(/requires a WHERE clause/)
    })
  })

  describe('tweets INSERT', () => {
    it('should serialize INSERT to POST /2/tweets with the text body', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'new-1' } }),
      })

      const handler = await loadHandler()

      await handler(
        { sql: "INSERT INTO twitter.tweets (text) VALUES ('hello world')" },
        headersWithToken()
      )

      const insertCall = mockCall.mock.calls[0]

      expect(insertCall[0]).toBe('https://api.x.com/2/tweets')
      expect(insertCall[1].method).toBe('POST')

      const body = JSON.parse(insertCall[1].body)

      expect(body).toEqual({ text: 'hello world' })
    })

    it('should nest in_reply_to_tweet_id under reply', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'new-2' } }),
      })

      const handler = await loadHandler()

      await handler(
        {
          sql: "INSERT INTO twitter.tweets (text, in_reply_to_tweet_id) VALUES ('yo', '42')",
        },
        headersWithToken()
      )

      const body = JSON.parse(mockCall.mock.calls[0][1].body)

      expect(body).toEqual({
        text: 'yo',
        reply: { in_reply_to_tweet_id: '42' },
      })
    })
  })

  describe('tweets DELETE', () => {
    it('should look up the row then DELETE /2/tweets/{id}', async () => {
      // @note first call resolves the row to delete (SELECT by id)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '456' } }),
      })

      // @note second call performs the delete
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const handler = await loadHandler()

      await handler(
        { sql: "DELETE FROM twitter.tweets WHERE id = '456'" },
        headersWithToken()
      )

      const deleteCall = mockCall.mock.calls[1]

      expect(deleteCall[0]).toBe('https://api.x.com/2/tweets/456')
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  describe('tweets UPDATE', () => {
    it('should reject UPDATE as unsupported', async () => {
      // @note update first selects the row(s) to update
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '1' } }),
      })

      const handler = await loadHandler()

      await expect(
        handler(
          { sql: "UPDATE twitter.tweets SET text = 'x' WHERE id = '1'" },
          headersWithToken()
        )
      ).rejects.toThrow(/not supported/)
    })
  })

  describe('users SELECT', () => {
    it('should serialize SELECT WHERE username to the username lookup endpoint', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: '1',
              username: 'nasa',
              public_metrics: { followers_count: 100 },
            },
          }),
      })

      const handler = await loadHandler()

      const result = await handler(
        { sql: "SELECT * FROM twitter.users WHERE username = 'nasa'" },
        headersWithToken()
      )

      expect(mockCall.mock.calls[0][0]).toMatch(
        /^https:\/\/api\.x\.com\/2\/users\/by\/username\/nasa\?/
      )
      expect(result.result[0].row).toEqual(
        expect.objectContaining({ username: 'nasa', followers_count: 100 })
      )
    })

    it('should reject INSERT into users', async () => {
      const handler = await loadHandler()

      await expect(
        handler(
          { sql: "INSERT INTO twitter.users (username) VALUES ('nasa')" },
          headersWithToken()
        )
      ).rejects.toThrow(/not supported/)
    })
  })

  describe('SHOW TABLES', () => {
    it('should list the available tables without an API call', async () => {
      const handler = await loadHandler()

      const { result } = await handler(
        { sql: 'SHOW TABLES' },
        headersWithToken()
      )

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ FULL_NAME: 'twitter.tweets' }),
          expect.objectContaining({ FULL_NAME: 'twitter.users' }),
        ])
      )
      expect(mockCall).not.toHaveBeenCalled()
    })
  })

  describe('Authentication', () => {
    it('should throw when no token is provided', async () => {
      const handler = await loadHandler()

      await expect(
        handler(
          { sql: "SELECT * FROM twitter.tweets WHERE id = '1'" },
          new Headers()
        )
      ).rejects.toThrow('Not authenticated')
    })
  })
})
