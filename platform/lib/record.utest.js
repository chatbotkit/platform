/**
 * @jest-environment node
 */
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import {
  RECORD_ID_NAMESPACE,
  createRecord,
  createRecordId,
  deleteRecord,
  deleteRecords,
  updateRecord,
  upsertRecord,
} from './record'

describe('record', () => {
  const mockStore = {
    createRecord: jest.fn(),
    updateRecord: jest.fn(),
    upsertRecord: jest.fn(),
    deleteRecord: jest.fn(),
    deleteRecords: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RECORD_ID_NAMESPACE', () => {
    it('should be a fixed UUID', () => {
      expect(RECORD_ID_NAMESPACE).toBe('5e2f3eed-689e-4597-be48-f6b4d9efca23')
    })
  })

  describe('createRecordId', () => {
    it('should generate consistent record IDs', () => {
      const options = {
        rootId: 'root123',
        datasetId: 'dataset456',
        source: 'https://example.com',
        index: 0,
      }

      const id1 = createRecordId(options)
      const id2 = createRecordId(options)

      expect(id1).toBe(id2)
      expect(id1).toMatch(/^root123-[a-f0-9]{32}$/)
    })

    it('should generate different IDs for different inputs', () => {
      const options1 = {
        rootId: 'root123',
        datasetId: 'dataset456',
        source: 'https://example.com',
        index: 0,
      }

      const options2 = {
        rootId: 'root123',
        datasetId: 'dataset456',
        source: 'https://example.com',
        index: 1,
      }

      const id1 = createRecordId(options1)
      const id2 = createRecordId(options2)

      expect(id1).not.toBe(id2)
    })

    it('should include rootId prefix', () => {
      const options = {
        rootId: 'myroot',
        datasetId: 'ds1',
        source: 'src',
        index: 0,
      }

      const id = createRecordId(options)

      expect(id).toMatch(/^myroot-/)
    })
  })

  describe('createRecord', () => {
    it('should create record in store', async () => {
      const recordId = 'record123'

      const result = await createRecord({
        store: mockStore,
        datasetId: 'dataset456',
        text: 'Test text',
        source: 'https://example.com',
        recordId: recordId,
        meta: { key: 'value' },
      })

      expect(result).toBe(recordId)
      expect(mockStore.createRecord).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Test text',
        source: 'https://example.com',
        meta: { key: 'value' },
      })
    })

    it('should handle empty text', async () => {
      const recordId = 'record123'

      await createRecord({
        store: mockStore,
        datasetId: 'dataset456',
        text: '',
        recordId: recordId,
      })

      expect(mockStore.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
        })
      )
    })

    it('should throw when datasetId is missing', async () => {
      await expect(
        createRecord({
          store: mockStore,
          datasetId: '',
          text: 'Test',
        })
      ).rejects.toThrow()
    })

    it('should normalize text according to the configured database limit', async () => {
      const recordId = 'record123'
      const longText = 'a'.repeat(100000)

      await createRecord({
        store: mockStore,
        datasetId: 'dataset456',
        text: longText,
        recordId: recordId,
      })

      const callArg = mockStore.createRecord.mock.calls[0][0]

      expect(callArg.text.length).toBe(
        Math.min(longText.length, MAX_DB_TEXT_BYTES_LENGTH)
      )
    })
  })

  describe('updateRecord', () => {
    it('should update record in store', async () => {
      const recordId = 'record123'

      const result = await updateRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Updated text',
        source: 'https://updated.com',
        meta: { updated: true },
      })

      expect(result).toBe(recordId)
      expect(mockStore.updateRecord).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Updated text',
        source: 'https://updated.com',
        meta: { updated: true },
      })
    })

    it('should throw when datasetId is missing', async () => {
      await expect(
        updateRecord({
          store: mockStore,
          datasetId: '',
          recordId: 'record123',
          text: 'Test',
        })
      ).rejects.toThrow()
    })

    it('should throw when recordId is missing', async () => {
      await expect(
        updateRecord({
          store: mockStore,
          datasetId: 'dataset456',
          recordId: '',
          text: 'Test',
        })
      ).rejects.toThrow()
    })

    it('should normalize text according to the configured database limit', async () => {
      const recordId = 'record123'
      const longText = 'a'.repeat(100000)

      await updateRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: recordId,
        text: longText,
      })

      const callArg = mockStore.updateRecord.mock.calls[0][0]

      expect(callArg.text.length).toBe(
        Math.min(longText.length, MAX_DB_TEXT_BYTES_LENGTH)
      )
    })
  })

  describe('upsertRecord', () => {
    it('should upsert record in store', async () => {
      const recordId = 'record123'

      const result = await upsertRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Upserted text',
        source: 'https://example.com',
        meta: { key: 'value' },
      })

      expect(result).toBe(recordId)
      expect(mockStore.upsertRecord).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Upserted text',
        source: 'https://example.com',
        meta: { key: 'value' },
      })
    })

    it('should handle undefined meta', async () => {
      const recordId = 'record123'

      await upsertRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: recordId,
        text: 'Test',
      })

      expect(mockStore.upsertRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: undefined,
        })
      )
    })

    it('should throw when datasetId is missing', async () => {
      await expect(
        upsertRecord({
          store: mockStore,
          datasetId: '',
          recordId: 'record123',
          text: 'Test',
        })
      ).rejects.toThrow()
    })

    it('should throw when recordId is missing', async () => {
      await expect(
        upsertRecord({
          store: mockStore,
          datasetId: 'dataset456',
          recordId: '',
          text: 'Test',
        })
      ).rejects.toThrow()
    })

    it('should normalize text according to the configured database limit', async () => {
      const recordId = 'record123'
      const longText = 'a'.repeat(100000)

      await upsertRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: recordId,
        text: longText,
      })

      const callArg = mockStore.upsertRecord.mock.calls[0][0]

      expect(callArg.text.length).toBe(
        Math.min(longText.length, MAX_DB_TEXT_BYTES_LENGTH)
      )
    })
  })

  describe('deleteRecord', () => {
    it('should delete record from store', async () => {
      await deleteRecord({
        store: mockStore,
        datasetId: 'dataset456',
        recordId: 'record123',
      })

      expect(mockStore.deleteRecord).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordId: 'record123',
      })
    })

    it('should throw when datasetId is missing', async () => {
      await expect(
        deleteRecord({
          store: mockStore,
          datasetId: '',
          recordId: 'record123',
        })
      ).rejects.toThrow()
    })

    it('should throw when recordId is missing', async () => {
      await expect(
        deleteRecord({
          store: mockStore,
          datasetId: 'dataset456',
          recordId: '',
        })
      ).rejects.toThrow()
    })
  })

  describe('deleteRecords', () => {
    it('should delete multiple records from store', async () => {
      const recordIds = ['record1', 'record2', 'record3']

      await deleteRecords({
        store: mockStore,
        datasetId: 'dataset456',
        recordIds: recordIds,
      })

      expect(mockStore.deleteRecords).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordIds: recordIds,
      })
    })

    it('should handle empty recordIds array', async () => {
      const recordIds = []

      await deleteRecords({
        store: mockStore,
        datasetId: 'dataset456',
        recordIds: recordIds,
      })

      expect(mockStore.deleteRecords).toHaveBeenCalledWith({
        datasetId: 'dataset456',
        recordIds: recordIds,
      })
    })

    it('should throw when datasetId is missing', async () => {
      await expect(
        deleteRecords({
          store: mockStore,
          datasetId: '',
          recordIds: ['record1'],
        })
      ).rejects.toThrow()
    })

    it('should throw when recordIds is missing', async () => {
      await expect(
        deleteRecords({
          store: mockStore,
          datasetId: 'dataset456',
          recordIds: null,
        })
      ).rejects.toThrow()
    })
  })
})
