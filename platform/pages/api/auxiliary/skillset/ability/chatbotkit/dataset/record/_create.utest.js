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
    record: {
      create: jest.fn(),
    },
  },
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/dataset/record/create')

const { getSessionClient } = require('@/lib/cbk.sdk')

describe('auxiliary/skillset/ability/chatbotkit/dataset/record/create', () => {
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

  describe('successful record creation', () => {
    it('should create a record and return the response', async () => {
      const createdRecord = { id: 'record-1', text: 'Hello world' }

      mockClient.dataset.record.create.mockResolvedValue(createdRecord)

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', text: 'Hello world' },
        mockHeaders
      )

      expect(getSessionClient).toHaveBeenCalledWith(mockSession)
      expect(mockClient.dataset.record.create).toHaveBeenCalledWith(
        'dataset-1',
        { text: 'Hello world' }
      )
      expect(result).toEqual(createdRecord)
    })

    it('should pass the correct datasetId and text to the SDK', async () => {
      mockClient.dataset.record.create.mockResolvedValue({ id: 'record-2' })

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-abc', text: 'A new record entry' },
        mockHeaders
      )

      expect(mockClient.dataset.record.create).toHaveBeenCalledWith('ds-abc', {
        text: 'A new record entry',
      })
    })
  })

  describe('error propagation', () => {
    it('should propagate SDK errors', async () => {
      mockClient.dataset.record.create.mockRejectedValue(
        new Error('Dataset not found')
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'nonexistent', text: 'test' },
          mockHeaders
        )
      ).rejects.toThrow('Dataset not found')
    })

    it('should propagate getSessionClient errors', async () => {
      getSessionClient.mockRejectedValue(new Error('Session expired'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', text: 'test' },
          mockHeaders
        )
      ).rejects.toThrow('Session expired')
    })
  })
})
