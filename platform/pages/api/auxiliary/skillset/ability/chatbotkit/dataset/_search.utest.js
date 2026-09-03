/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    capturedHandlerFn = fn

    return jest.fn()
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

const mockClient = {
  dataset: {
    search: jest.fn(),
  },
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/dataset/search')

const { getSessionClient } = require('@/lib/cbk.sdk')

describe('auxiliary/skillset/ability/chatbotkit/dataset/search', () => {
  const mockSession = { user: { id: 'user-123' }, id: 'session-abc' }
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
    getSessionClient.mockResolvedValue(mockClient)
  })

  it('should export an authenticated handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('successful search', () => {
    it('should search a dataset and return matching records', async () => {
      const searchResults = {
        items: [
          { id: 'rec-1', text: 'Hello world', score: 0.95 },
          { id: 'rec-2', text: 'Hello there', score: 0.88 },
        ],
      }

      mockClient.dataset.search.mockResolvedValue(searchResults)

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', text: 'Hello' },
        mockHeaders
      )

      expect(getSessionClient).toHaveBeenCalledWith(mockSession)
      expect(mockClient.dataset.search).toHaveBeenCalledWith(
        'dataset-1',
        'Hello'
      )
      expect(result).toEqual(searchResults)
    })

    it('should pass the correct datasetId and text to the SDK', async () => {
      mockClient.dataset.search.mockResolvedValue({ items: [] })

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-abc', text: 'search query here' },
        mockHeaders
      )

      expect(mockClient.dataset.search).toHaveBeenCalledWith(
        'ds-abc',
        'search query here'
      )
    })

    it('should return empty results when no records match', async () => {
      mockClient.dataset.search.mockResolvedValue({ items: [] })

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', text: 'nonexistent term' },
        mockHeaders
      )

      expect(result).toEqual({ items: [] })
    })
  })

  describe('error propagation', () => {
    it('should propagate SDK errors when dataset is not found', async () => {
      mockClient.dataset.search.mockRejectedValue(
        new Error('Dataset not found')
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'missing-ds', text: 'query' },
          mockHeaders
        )
      ).rejects.toThrow('Dataset not found')
    })

    it('should propagate getSessionClient errors', async () => {
      getSessionClient.mockRejectedValue(new Error('Authentication failed'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', text: 'query' },
          mockHeaders
        )
      ).rejects.toThrow('Authentication failed')
    })
  })
})
