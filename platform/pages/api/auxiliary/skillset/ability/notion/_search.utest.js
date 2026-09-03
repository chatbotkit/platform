/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    capturedHandlerFn = (parameters, headers) =>
      fn({ user: { id: 'test-user-id' } }, parameters, headers)

    return jest.fn()
  }),
}))

jest.mock(
  '@chatbotkit-dev/auxiliary-notion',
  () => ({
    searchHandler: jest.fn(),
  }),
  { virtual: true }
)

jest.mock('@/lib/call', () => jest.fn())

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/notion/search')

const { searchHandler } = require('@chatbotkit-dev/auxiliary-notion')

describe('auxiliary/skillset/ability/notion/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should export a handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('token validation', () => {
    it('should throw when x-access-token header is missing', async () => {
      const headers = new Headers()

      await expect(
        capturedHandlerFn({ pageSize: 20, simplifiedProperties: true }, headers)
      ).rejects.toThrow()

      expect(searchHandler).not.toHaveBeenCalled()
    })

    it('should throw when x-access-token is an empty string', async () => {
      const headers = new Headers({ 'x-access-token': '' })

      await expect(
        capturedHandlerFn({ pageSize: 20, simplifiedProperties: true }, headers)
      ).rejects.toThrow()

      expect(searchHandler).not.toHaveBeenCalled()
    })

    it('should throw when x-access-token is whitespace only', async () => {
      const headers = new Headers({ 'x-access-token': '   ' })

      await expect(
        capturedHandlerFn({ pageSize: 20, simplifiedProperties: true }, headers)
      ).rejects.toThrow()

      expect(searchHandler).not.toHaveBeenCalled()
    })

    it('should proceed when x-access-token is a valid token', async () => {
      const headers = new Headers({ 'x-access-token': 'valid-token-abc' })

      searchHandler.mockResolvedValue({ results: [] })

      await capturedHandlerFn(
        { pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'valid-token-abc' })
      )
    })
  })

  describe('search parameters', () => {
    const headers = new Headers({ 'x-access-token': 'test-token' })

    beforeEach(() => {
      searchHandler.mockResolvedValue({ results: [] })
    })

    it('should pass query to searchHandler when provided', async () => {
      await capturedHandlerFn(
        { query: 'meeting notes', pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'meeting notes' })
      )
    })

    it('should pass undefined for query when query is empty string', async () => {
      await capturedHandlerFn(
        { query: '', pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ query: undefined })
      )
    })

    it('should pass undefined for query when not provided', async () => {
      await capturedHandlerFn(
        { pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ query: undefined })
      )
    })

    it('should pass startCursor when provided', async () => {
      await capturedHandlerFn(
        {
          startCursor: 'cursor-xyz',
          pageSize: 20,
          simplifiedProperties: true,
        },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ startCursor: 'cursor-xyz' })
      )
    })

    it('should pass undefined for startCursor when it is whitespace', async () => {
      await capturedHandlerFn(
        {
          startCursor: '   ',
          pageSize: 20,
          simplifiedProperties: true,
        },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ startCursor: undefined })
      )
    })

    it('should pass pageSize to searchHandler', async () => {
      await capturedHandlerFn(
        { pageSize: 50, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 50 })
      )
    })

    it('should fall back to pageSize 20 when pageSize is 0', async () => {
      await capturedHandlerFn(
        { pageSize: 0, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20 })
      )
    })

    it('should pass simplifiedProperties flag to searchHandler', async () => {
      await capturedHandlerFn(
        { pageSize: 20, simplifiedProperties: false },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ simplifiedProperties: false })
      )
    })

    it('should pass the call function to searchHandler as fetch', async () => {
      const call = require('@/lib/call')

      await capturedHandlerFn(
        { pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(searchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ fetch: call })
      )
    })
  })

  describe('result propagation', () => {
    it('should return the result from searchHandler', async () => {
      const headers = new Headers({ 'x-access-token': 'test-token' })
      const mockResult = {
        results: [{ id: 'page-1', title: 'My Page' }],
        next_cursor: 'next-abc',
        has_more: true,
      }

      searchHandler.mockResolvedValue(mockResult)

      const result = await capturedHandlerFn(
        { pageSize: 20, simplifiedProperties: true },
        headers
      )

      expect(result).toEqual(mockResult)
    })
  })
})
