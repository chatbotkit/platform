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

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/pages/api/v1/url/unfurl', () => ({
  unfurlPage: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/url/unfurl')

const { unfurlPage } = require('@/pages/api/v1/url/unfurl')

describe('auxiliary/skillset/ability/chatbotkit/url/unfurl', () => {
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should export a handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('successful unfurling', () => {
    it('should unfurl a URL and return the page data', async () => {
      const unfurlResult = {
        html: '<html><head><title>Example</title></head><body>Hello</body></html>',
        data: {
          title: 'Example Domain',
          description: 'This is an example domain',
          url: 'https://example.com',
        },
      }

      unfurlPage.mockResolvedValue(unfurlResult)

      const result = await capturedHandlerFn(
        { url: 'https://example.com' },
        mockHeaders
      )

      expect(unfurlPage).toHaveBeenCalledWith('https://example.com')
      expect(result).toEqual(unfurlResult)
    })

    it('should pass the exact URL to unfurlPage', async () => {
      unfurlPage.mockResolvedValue({ html: '', data: {} })

      await capturedHandlerFn(
        { url: 'https://blog.example.com/article/123' },
        mockHeaders
      )

      expect(unfurlPage).toHaveBeenCalledWith(
        'https://blog.example.com/article/123'
      )
      expect(unfurlPage).toHaveBeenCalledTimes(1)
    })

    it('should return empty data for pages that cannot be unfurled', async () => {
      unfurlPage.mockResolvedValue({ data: {} })

      const result = await capturedHandlerFn(
        { url: 'https://private.example.com' },
        mockHeaders
      )

      expect(result).toEqual({ data: {} })
    })
  })

  describe('error propagation', () => {
    it('should propagate errors from unfurlPage', async () => {
      unfurlPage.mockRejectedValue(new Error('Failed to fetch page'))

      await expect(
        capturedHandlerFn({ url: 'https://example.com' }, mockHeaders)
      ).rejects.toThrow('Failed to fetch page')
    })

    it('should propagate network errors', async () => {
      unfurlPage.mockRejectedValue(new TypeError('Network request failed'))

      await expect(
        capturedHandlerFn(
          { url: 'https://unreachable.example.com' },
          mockHeaders
        )
      ).rejects.toThrow('Network request failed')
    })
  })
})
