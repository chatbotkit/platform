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

// Import after mocks are set up so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/openstreetmap/overpass/amenity/around/list')

const mockCall = require('@/lib/call').default

describe('openstreetmap/overpass/amenity/around/list', () => {
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('query construction', () => {
    it('should send a valid Overpass query with no duplicate out statements', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                id: 1,
                type: 'node',
                lat: 52.5,
                lon: 13.4,
                tags: { amenity: 'cafe' },
              },
            ],
          }),
      })

      await capturedHandlerFn(
        { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
        mockHeaders
      )

      const callArgs = mockCall.mock.calls[0]
      const url = callArgs[0]
      const queryData = new URL(url).searchParams.get('data')

      // The query must start with [out:json]
      expect(queryData).toContain('[out:json]')

      // There must be no 'out body center 3' after 'out skel qt' - that creates an invalid query
      expect(queryData).not.toMatch(/out skel qt;\s*out body center 3;/)
    })

    it('should include the correct lat, lon, and radius in the query', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      })

      await capturedHandlerFn(
        { tags: 'amenity=restaurant', lat: 48.8566, lon: 2.3522, radius: 500 },
        mockHeaders
      )

      const callArgs = mockCall.mock.calls[0]
      const url = callArgs[0]
      const queryData = new URL(url).searchParams.get('data')

      expect(queryData).toContain('around:500,48.8566,2.3522')
    })

    it('should include the correct tag filter in the query', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      })

      await capturedHandlerFn(
        { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
        mockHeaders
      )

      const callArgs = mockCall.mock.calls[0]
      const url = callArgs[0]
      const queryData = new URL(url).searchParams.get('data')

      expect(queryData).toContain('[amenity=cafe]')
    })

    it('should support multiple types', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      })

      await capturedHandlerFn(
        { tags: 'amenity=cafe', types: 'node,way', lat: 52.5, lon: 13.4 },
        mockHeaders
      )

      const callArgs = mockCall.mock.calls[0]
      const url = callArgs[0]
      const queryData = new URL(url).searchParams.get('data')

      expect(queryData).toContain('node(around:')
      expect(queryData).toContain('way(around:')
    })
  })

  describe('response handling', () => {
    it('should return filtered items with tags', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                id: 1,
                type: 'node',
                lat: 52.5,
                lon: 13.4,
                tags: { amenity: 'cafe' },
              },
              { id: 2, type: 'node', lat: 52.5, lon: 13.4 },
            ],
          }),
      })

      const result = await capturedHandlerFn(
        { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
        mockHeaders
      )

      // Items without tags should be filtered out
      expect(result.items).toHaveLength(1)
      expect(result.items[0].tags).toEqual({ amenity: 'cafe' })
    })

    it('should strip nodes property from elements', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                id: 1,
                type: 'way',
                nodes: [100, 101, 102],
                tags: { amenity: 'park' },
              },
            ],
          }),
      })

      const result = await capturedHandlerFn(
        { tags: 'amenity=park', lat: 52.5, lon: 13.4 },
        mockHeaders
      )

      expect(result.items[0].nodes).toBeUndefined()
    })

    it('should throw error when API returns non-JSON response', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      })

      await expect(
        capturedHandlerFn(
          { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
          mockHeaders
        )
      ).rejects.toThrow('Overpass API returned invalid JSON response')
    })

    it('should throw a FetchError (not a plain Error) when API returns non-JSON response to avoid Sentry capture', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      })

      try {
        await capturedHandlerFn(
          { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
          mockHeaders
        )
      } catch (e) {
        const { FetchError } = require('@/lib/fetch')

        // @note the auxiliary handler skips Sentry capture for FetchError instances,
        // so throwing a plain Error here would cause unnecessary Sentry noise
        expect(e).toBeInstanceOf(FetchError)
      }
    })

    it('should throw error when API returns non-ok status', async () => {
      mockCall.mockResolvedValueOnce({
        ok: false,
        status: 429,
      })

      await expect(
        capturedHandlerFn(
          { tags: 'amenity=cafe', lat: 52.5, lon: 13.4 },
          mockHeaders
        )
      ).rejects.toThrow('API Error: 429')
    })
  })
})
