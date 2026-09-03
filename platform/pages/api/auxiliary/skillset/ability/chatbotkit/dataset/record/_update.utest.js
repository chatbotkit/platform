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
      update: jest.fn(),
    },
  },
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/dataset/record/update')

const { getSessionClient } = require('@/lib/cbk.sdk')

describe('auxiliary/skillset/ability/chatbotkit/dataset/record/update', () => {
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

  describe('successful record update', () => {
    it('should update a record and return the response', async () => {
      const updatedRecord = { id: 'record-1', text: 'Updated text' }

      mockClient.dataset.record.update.mockResolvedValue(updatedRecord)

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', recordId: 'record-1', text: 'Updated text' },
        mockHeaders
      )

      expect(getSessionClient).toHaveBeenCalledWith(mockSession)
      expect(mockClient.dataset.record.update).toHaveBeenCalledWith(
        'dataset-1',
        'record-1',
        { text: 'Updated text' }
      )
      expect(result).toEqual(updatedRecord)
    })

    it('should pass the correct datasetId, recordId and text to the SDK', async () => {
      mockClient.dataset.record.update.mockResolvedValue({ id: 'record-2' })

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-xyz', recordId: 'rec-99', text: 'New content here' },
        mockHeaders
      )

      expect(mockClient.dataset.record.update).toHaveBeenCalledWith(
        'ds-xyz',
        'rec-99',
        { text: 'New content here' }
      )
    })
  })

  describe('error propagation', () => {
    it('should propagate SDK errors when record is not found', async () => {
      mockClient.dataset.record.update.mockRejectedValue(
        new Error('Record not found')
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', recordId: 'missing', text: 'test' },
          mockHeaders
        )
      ).rejects.toThrow('Record not found')
    })

    it('should propagate getSessionClient errors', async () => {
      getSessionClient.mockRejectedValue(new Error('Invalid session'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', recordId: 'record-1', text: 'test' },
          mockHeaders
        )
      ).rejects.toThrow('Invalid session')
    })
  })
})
