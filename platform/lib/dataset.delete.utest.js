/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  deleteDataset,
  deleteDatasetAndStore,
  deleteManyDatasets,
} from './dataset.delete'
import { getStore } from './store.types'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    conversation: {
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('./store.types', () => ({
  getStore: jest.fn(),
}))

describe('dataset.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteDatasetAndStore', () => {
    it('should delete store reference before dataset', async () => {
      const dataset = { id: 'dataset-123' }
      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          dataset: {
            delete: jest.fn().mockResolvedValue(dataset),
          },
        })
      })

      await deleteDatasetAndStore(dataset, mockStore)

      expect(mockStore.deleteDataset).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
      })
      expect(mockStore.deleteDataset).toHaveBeenCalledBefore(
        prisma.$transaction
      )
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('should update conversations and delete dataset in transaction', async () => {
      const dataset = { id: 'dataset-456' }
      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        dataset: {
          delete: jest.fn().mockResolvedValue(dataset),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteDatasetAndStore(dataset, mockStore)

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.dataset.delete).toHaveBeenCalledWith({
        where: { id: 'dataset-456' },
      })
    })

    it('should handle store deletion errors', async () => {
      const dataset = { id: 'dataset-789' }
      const mockStore = {
        deleteDataset: jest.fn().mockRejectedValue(new Error('Store error')),
      }

      await expect(deleteDatasetAndStore(dataset, mockStore)).rejects.toThrow(
        'Store error'
      )

      expect(mockStore.deleteDataset).toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('deleteDataset', () => {
    it('should delete dataset with its store', async () => {
      const dataset = { id: 'dataset-abc' }
      const foundDataset = { id: 'dataset-abc' }
      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      prisma.dataset.findUnique.mockResolvedValue(foundDataset)
      getStore.mockResolvedValue(mockStore)

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          dataset: {
            delete: jest.fn().mockResolvedValue(dataset),
          },
        })
      })

      await deleteDataset(dataset)

      expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
        where: { id: 'dataset-abc' },
      })
      expect(getStore).toHaveBeenCalledWith()
      expect(mockStore.deleteDataset).toHaveBeenCalledWith({
        datasetId: 'dataset-abc',
      })
    })

    it('should return early if dataset does not exist', async () => {
      const dataset = { id: 'nonexistent' }

      prisma.dataset.findUnique.mockResolvedValue(null)

      await deleteDataset(dataset)

      expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      })
      expect(getStore).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const dataset = { id: 'dataset-err' }

      prisma.dataset.findUnique.mockRejectedValue(
        new Error('Database connection error')
      )

      await expect(deleteDataset(dataset)).rejects.toThrow(
        'Database connection error'
      )
    })
  })

  describe('deleteManyDatasets', () => {
    it('should delete multiple datasets in parallel', async () => {
      const datasets = [{ id: 'dataset-1' }, { id: 'dataset-2' }]

      const foundDataset1 = { id: 'dataset-1' }
      const foundDataset2 = { id: 'dataset-2' }

      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      prisma.dataset.findUnique
        .mockResolvedValueOnce(foundDataset1)
        .mockResolvedValueOnce(foundDataset2)

      getStore.mockResolvedValue(mockStore)

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          dataset: {
            delete: jest.fn().mockResolvedValue({}),
          },
        })
      })

      await deleteManyDatasets(datasets)

      expect(prisma.dataset.findUnique).toHaveBeenCalledTimes(2)
      expect(getStore).toHaveBeenCalledTimes(2)
      expect(mockStore.deleteDataset).toHaveBeenCalledTimes(2)
    })

    it('should handle empty array', async () => {
      await deleteManyDatasets([])

      expect(prisma.dataset.findUnique).not.toHaveBeenCalled()
    })

    it('should handle partial failures', async () => {
      const datasets = [{ id: 'dataset-1' }, { id: 'dataset-2' }]

      prisma.dataset.findUnique
        .mockResolvedValueOnce({ id: 'dataset-1' })
        .mockRejectedValueOnce(new Error('Dataset 2 not found'))

      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      getStore.mockResolvedValue(mockStore)

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          dataset: {
            delete: jest.fn().mockResolvedValue({}),
          },
        })
      })

      await expect(deleteManyDatasets(datasets)).rejects.toThrow(
        'Dataset 2 not found'
      )
    })

    it('should skip non-existent datasets', async () => {
      const datasets = [{ id: 'dataset-1' }, { id: 'dataset-2' }]

      const foundDataset = { id: 'dataset-1' }

      prisma.dataset.findUnique
        .mockResolvedValueOnce(foundDataset)
        .mockResolvedValueOnce(null)

      const mockStore = {
        deleteDataset: jest.fn().mockResolvedValue(undefined),
      }

      getStore.mockResolvedValue(mockStore)

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          conversation: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          dataset: {
            delete: jest.fn().mockResolvedValue({}),
          },
        })
      })

      await deleteManyDatasets(datasets)

      expect(prisma.dataset.findUnique).toHaveBeenCalledTimes(2)
      expect(mockStore.deleteDataset).toHaveBeenCalledTimes(1)
    })
  })
})
