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
      delete: jest.fn(),
    },
  },
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/dataset/record/delete')

const { getSessionClient } = require('@/lib/cbk.sdk')

describe('auxiliary/skillset/ability/chatbotkit/dataset/record/delete', () => {
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

  describe('successful record deletion', () => {
    it('should delete a record and return the response', async () => {
      const deleteResponse = { id: 'record-1' }

      mockClient.dataset.record.delete.mockResolvedValue(deleteResponse)

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', recordId: 'record-1' },
        mockHeaders
      )

      expect(getSessionClient).toHaveBeenCalledWith(mockSession)
      expect(mockClient.dataset.record.delete).toHaveBeenCalledWith(
        'dataset-1',
        'record-1'
      )
      expect(result).toEqual(deleteResponse)
    })

    it('should pass the correct datasetId and recordId to the SDK', async () => {
      mockClient.dataset.record.delete.mockResolvedValue({ id: 'record-99' })

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-abc', recordId: 'rec-99' },
        mockHeaders
      )

      expect(mockClient.dataset.record.delete).toHaveBeenCalledWith(
        'ds-abc',
        'rec-99'
      )
      expect(mockClient.dataset.record.delete).toHaveBeenCalledTimes(1)
    })
  })

  describe('error propagation', () => {
    it('should propagate SDK errors when record is not found', async () => {
      mockClient.dataset.record.delete.mockRejectedValue(
        new Error('Record not found')
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', recordId: 'missing' },
          mockHeaders
        )
      ).rejects.toThrow('Record not found')
    })

    it('should propagate getSessionClient errors', async () => {
      getSessionClient.mockRejectedValue(new Error('Session expired'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', recordId: 'record-1' },
          mockHeaders
        )
      ).rejects.toThrow('Session expired')
    })
  })
})
