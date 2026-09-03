import { chunkFile } from '@/lib/chunk'
import { upsertRecord } from '@/lib/record'

import { splitImportBlob } from '@/pages/api/v1/dataset/[datasetId]/queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {},
}))

jest.mock('@/lib/record', () => ({
  createRecordId: jest.fn(() => 'mock-record-id'),
  upsertRecord: jest.fn(),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(() => Promise.resolve({ id: 'mock-store' })),
}))

jest.mock('@/lib/chunk', () => ({
  chunkFile: jest.fn(),
  chunkUrl: jest.fn(),
}))

const capturedErrors = []

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),

  captureError: jest.fn((e) => capturedErrors.push(e)),
}))

describe('dataset queue', () => {
  const mockDataset = {
    id: 'dataset-123',
    userId: 'user-123',
    recordMaxTokens: null,
    separators: null,
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedErrors.length = 0
  })

  describe('splitImportBlob', () => {
    it('should skip items with empty or whitespace-only text without errors', async () => {
      // Simulate chunkFile returning items with empty/whitespace text
      // This can happen when html2text extracts content from pages with
      // only navigation, headers, footers that are filtered out
      chunkFile.mockResolvedValue({
        items: [
          { text: '', meta: {} }, // empty string
          { text: '   ', meta: {} }, // whitespace only
          { text: '\n\n', meta: {} }, // newlines only
          { text: 'valid content', meta: {} }, // valid
          { text: '  \t\n  ', meta: {} }, // mixed whitespace
        ],
        request: {},
      })

      const blob = new Blob(['some content'], { type: 'text/plain' })

      await splitImportBlob({
        dataset: mockDataset,
        blob,
        source: 'https://example.com/page',
        meta: {},
      })

      // Should not have any assertion errors captured
      const assertionErrors = capturedErrors.filter(
        (e) => e?.message === 'unexpected empty text'
      )

      expect(assertionErrors).toHaveLength(0)

      // Should only call upsertRecord for the one valid item
      expect(upsertRecord).toHaveBeenCalledTimes(1)
      expect(upsertRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'valid content',
        })
      )
    })

    it('should process valid items normally', async () => {
      chunkFile.mockResolvedValue({
        items: [
          { text: 'first chunk', meta: { page: 1 } },
          { text: 'second chunk', meta: { page: 2 } },
        ],
        request: {},
      })

      const blob = new Blob(['some content'], { type: 'text/plain' })

      await splitImportBlob({
        dataset: mockDataset,
        blob,
        source: 'file:///test.txt',
        meta: {},
      })

      expect(upsertRecord).toHaveBeenCalledTimes(2)
    })

    it('should abort early for empty blob', async () => {
      const blob = new Blob([], { type: 'text/plain' })

      await splitImportBlob({
        dataset: mockDataset,
        blob,
        source: 'file:///empty.txt',
        meta: {},
      })

      expect(chunkFile).not.toHaveBeenCalled()
      expect(upsertRecord).not.toHaveBeenCalled()
    })
  })
})
