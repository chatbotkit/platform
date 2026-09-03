/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  doDatasetCreate,
  doDatasetList,
  doDatasetRecordCreate,
  doDatasetRecordDelete,
  doDatasetSearch,
  executeDatasetAction,
} from './action.exec.dataset'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('./dataset.search', () => ({
  searchDataset: jest.fn(),
}))

jest.mock('./dataset.access', () => ({
  canUseDataset: jest.fn(),
}))

jest.mock('./record', () => ({
  createRecord: jest.fn(),
  deleteRecord: jest.fn(),
}))

jest.mock('./store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/config/models', () => ({
  defaultRerankModel: 'default-reranker',
}))

jest.mock('@/schemas/name', () => ({
  __esModule: true,
  default: {
    validate: jest.fn(),
  },
}))

jest.mock('@/schemas/description', () => ({
  __esModule: true,
  default: {
    validate: jest.fn(),
  },
}))

describe('doDatasetList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  it('should list datasets with default params', async () => {
    const mockDatasets = [
      {
        id: 'dataset1',
        name: 'Dataset 1',
        description: 'First dataset',
        meta: {},
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'dataset2',
        name: 'Dataset 2',
        description: 'Second dataset',
        meta: {},
        createdAt: new Date('2024-01-02'),
      },
    ]

    prisma.dataset.findMany.mockResolvedValue(mockDatasets)

    const result = await doDatasetList({
      input: '',
      params: {},
      options: { userId: 'user123' },
    })

    expect(prisma.dataset.findMany).toHaveBeenCalledWith({
      where: { userId: 'user123' },
      select: {
        id: true,
        name: true,
        description: true,
        meta: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    expect(result).toEqual({
      result: {
        items: mockDatasets,
        hasMore: false,
        cursor: 'dataset2',
      },
      messages: [],
    })
  })

  it('should list datasets with custom order and take', async () => {
    prisma.dataset.findMany.mockResolvedValue([])

    await doDatasetList({
      input: '',
      params: { order: 'asc', take: 5 },
      options: { userId: 'user123' },
    })

    expect(prisma.dataset.findMany).toHaveBeenCalledWith({
      where: { userId: 'user123' },
      select: {
        id: true,
        name: true,
        description: true,
        meta: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })
  })

  it('should indicate hasMore when results equal take limit', async () => {
    const mockDatasets = Array(10)
      .fill()
      .map((_, i) => ({
        id: `dataset${i}`,
        name: `Dataset ${i}`,
        description: '',
        meta: {},
        createdAt: new Date(),
      }))

    prisma.dataset.findMany.mockResolvedValue(mockDatasets)

    const result = await doDatasetList({
      input: '',
      params: { take: 10 },
      options: { userId: 'user123' },
    })

    expect(result.result.hasMore).toBe(true)
    expect(result.result.cursor).toBe('dataset9')
  })

  it('should handle empty result set', async () => {
    prisma.dataset.findMany.mockResolvedValue([])

    const result = await doDatasetList({
      input: '',
      params: {},
      options: { userId: 'user123' },
    })

    expect(result).toEqual({
      result: {
        items: [],
        hasMore: false,
        cursor: null,
      },
      messages: [],
    })
  })
})

describe('doDatasetCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  it('should create dataset with name from input', async () => {
    const { getStore } = require('./store.types')
    const nameSchema = require('@/schemas/name').default

    const mockStore = {
      createDataset: jest.fn(),
    }

    prisma.dataset.create.mockResolvedValue({ id: 'new-dataset-id' })
    getStore.mockResolvedValue(mockStore)
    nameSchema.validate.mockReturnValue(undefined)

    const result = await doDatasetCreate({
      input: 'My Dataset',
      params: {},
      options: { userId: 'user123' },
    })

    expect(prisma.dataset.create).toHaveBeenCalledWith({
      data: {
        userId: 'user123',
        name: 'My Dataset',
        description: undefined,
        reranker: 'default-reranker',
      },
    })

    expect(getStore).toHaveBeenCalledWith()
    expect(mockStore.createDataset).toHaveBeenCalledWith({
      datasetId: 'new-dataset-id',
    })

    expect(result).toEqual({
      result: { id: 'new-dataset-id' },
      messages: [],
    })
  })

  it('should create dataset with name and description from params', async () => {
    const { getStore } = require('./store.types')
    const nameSchema = require('@/schemas/name').default
    const descriptionSchema = require('@/schemas/description').default

    const mockStore = {
      createDataset: jest.fn(),
    }

    prisma.dataset.create.mockResolvedValue({ id: 'new-dataset-id' })
    getStore.mockResolvedValue(mockStore)
    nameSchema.validate.mockReturnValue(undefined)
    descriptionSchema.validate.mockReturnValue(undefined)

    await doDatasetCreate({
      input: '',
      params: { name: 'Custom Dataset', description: 'Custom description' },
      options: { userId: 'user123' },
    })

    expect(prisma.dataset.create).toHaveBeenCalledWith({
      data: {
        userId: 'user123',
        name: 'Custom Dataset',
        description: 'Custom description',
        reranker: 'default-reranker',
      },
    })
  })
})

describe('doDatasetSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should search dataset with text from input', async () => {
    const { searchDataset } = require('./dataset.search')

    searchDataset.mockResolvedValue([
      { text: 'Result 1' },
      { text: 'Result 2' },
    ])

    const mockDataset = {
      id: 'dataset123',
    }

    const result = await doDatasetSearch({
      dataset: mockDataset,
      input: 'search query',
      params: {},
      options: { userId: 'user123' },
    })

    expect(searchDataset).toHaveBeenCalledWith(
      'user123',
      mockDataset,
      'search query',
      undefined
    )

    expect(result).toEqual({
      result: ['Result 1', 'Result 2'],
      messages: [],
    })
  })

  it('should search dataset with text from params', async () => {
    const { searchDataset } = require('./dataset.search')

    searchDataset.mockResolvedValue([{ text: 'Found item' }])

    const mockDataset = {
      id: 'dataset123',
    }

    await doDatasetSearch({
      dataset: mockDataset,
      input: '',
      params: { text: 'param query' },
      options: { userId: 'user123' },
    })

    expect(searchDataset).toHaveBeenCalledWith(
      'user123',
      mockDataset,
      'param query',
      undefined
    )
  })

  it('should support search alias for text param', async () => {
    const { searchDataset } = require('./dataset.search')

    searchDataset.mockResolvedValue([])

    const mockDataset = {
      id: 'dataset123',
    }

    await doDatasetSearch({
      dataset: mockDataset,
      input: 'search alias',
      params: {},
      options: { userId: 'user123' },
    })

    expect(searchDataset).toHaveBeenCalledWith(
      'user123',
      mockDataset,
      'search alias',
      undefined
    )
  })

  it('should support query alias for text param', async () => {
    const { searchDataset } = require('./dataset.search')

    searchDataset.mockResolvedValue([])

    const mockDataset = {
      id: 'dataset123',
    }

    await doDatasetSearch({
      dataset: mockDataset,
      input: 'query alias',
      params: {},
      options: { userId: 'user123' },
    })

    expect(searchDataset).toHaveBeenCalledWith(
      'user123',
      mockDataset,
      'query alias',
      undefined
    )
  })

  it('should pass filter parameter to searchDataset', async () => {
    const { searchDataset } = require('./dataset.search')

    searchDataset.mockResolvedValue([])

    const mockDataset = {
      id: 'dataset123',
    }

    const mockFilter = { type: 'document' }

    await doDatasetSearch({
      dataset: mockDataset,
      input: 'query',
      params: { filter: mockFilter },
      options: { userId: 'user123' },
    })

    expect(searchDataset).toHaveBeenCalledWith(
      'user123',
      mockDataset,
      'query',
      mockFilter
    )
  })

  it('should throw error when text is missing', async () => {
    const mockDataset = {
      id: 'dataset123',
    }

    await expect(
      doDatasetSearch({
        dataset: mockDataset,
        input: '',
        params: {},
        options: { userId: 'user123' },
      })
    ).rejects.toThrow("Missing 'text' parameter")
  })
})

describe('doDatasetRecordCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create record with text from input', async () => {
    const { createRecord } = require('./record')
    const { getStore } = require('./store.types')

    const mockStore = {}

    getStore.mockResolvedValue(mockStore)
    createRecord.mockResolvedValue({ id: 'record123' })

    const mockDataset = {
      id: 'dataset123',
    }

    const result = await doDatasetRecordCreate({
      dataset: mockDataset,
      input: 'Record text content',
      params: {},
      options: { userId: 'user123' },
    })

    expect(getStore).toHaveBeenCalledWith()
    expect(createRecord).toHaveBeenCalledWith({
      store: mockStore,
      datasetId: 'dataset123',
      text: 'Record text content',
    })

    expect(result).toEqual({
      result: { id: 'record123' },
      messages: [],
    })
  })

  it('should create record with text from params', async () => {
    const { createRecord } = require('./record')
    const { getStore } = require('./store.types')

    const mockStore = {}

    getStore.mockResolvedValue(mockStore)
    createRecord.mockResolvedValue({ id: 'record456' })

    const mockDataset = {
      id: 'dataset123',
    }

    await doDatasetRecordCreate({
      dataset: mockDataset,
      input: '',
      params: { text: 'Param text content' },
      options: { userId: 'user123' },
    })

    expect(createRecord).toHaveBeenCalledWith({
      store: mockStore,
      datasetId: 'dataset123',
      text: 'Param text content',
    })
  })

  it('should throw error when text is missing', async () => {
    const mockDataset = {
      id: 'dataset123',
    }

    await expect(
      doDatasetRecordCreate({
        dataset: mockDataset,
        input: '',
        params: {},
        options: { userId: 'user123' },
      })
    ).rejects.toThrow("Missing 'text' parameter")
  })
})

describe('doDatasetRecordDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete record by recordId', async () => {
    const { deleteRecord } = require('./record')
    const { getStore } = require('./store.types')

    const mockStore = {}

    getStore.mockResolvedValue(mockStore)
    deleteRecord.mockResolvedValue(undefined)

    const mockDataset = {
      id: 'dataset123',
    }

    const result = await doDatasetRecordDelete({
      dataset: mockDataset,
      input: '',
      params: { recordId: 'record123' },
      options: { userId: 'user123' },
    })

    expect(getStore).toHaveBeenCalledWith()
    expect(deleteRecord).toHaveBeenCalledWith({
      store: mockStore,
      datasetId: 'dataset123',
      recordId: 'record123',
    })

    expect(result).toEqual({
      result: { id: 'record123' },
      messages: [],
    })
  })

  it('should throw error when recordId is missing', async () => {
    const mockDataset = {
      id: 'dataset123',
    }

    await expect(
      doDatasetRecordDelete({
        dataset: mockDataset,
        input: '',
        params: {},
        options: { userId: 'user123' },
      })
    ).rejects.toThrow("Missing 'recordId' parameter")
  })
})

describe('executeDatasetAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  it('should execute list operation', async () => {
    prisma.dataset.findMany.mockResolvedValue([])

    const result = await executeDatasetAction(
      '',
      { list: true },
      { userId: 'user123' }
    )

    expect(result).toEqual({
      result: { items: [], hasMore: false, cursor: null },
      messages: [],
    })
  })

  it('should execute create operation', async () => {
    const { getStore } = require('./store.types')
    const nameSchema = require('@/schemas/name').default

    const mockStore = { createDataset: jest.fn() }

    prisma.dataset.create.mockResolvedValue({ id: 'new-id' })
    getStore.mockResolvedValue(mockStore)
    nameSchema.validate.mockReturnValue(undefined)

    const result = await executeDatasetAction(
      'New Dataset',
      { create: true },
      { userId: 'user123' }
    )

    expect(result).toEqual({
      result: { id: 'new-id' },
      messages: [],
    })
  })

  it('should execute search operation', async () => {
    const { searchDataset } = require('./dataset.search')
    const { canUseDataset } = require('./dataset.access')

    const mockDataset = { id: 'dataset123' }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
    canUseDataset.mockResolvedValue(true)
    searchDataset.mockResolvedValue([{ text: 'Result' }])

    const result = await executeDatasetAction(
      'search query',
      { search: '', datasetId: 'dataset123' },
      { userId: 'user123' }
    )

    expect(result).toEqual({
      result: ['Result'],
      messages: [],
    })
  })

  it('should execute record create operation', async () => {
    const { createRecord } = require('./record')
    const { getStore } = require('./store.types')
    const { canUseDataset } = require('./dataset.access')

    const mockDataset = { id: 'dataset123' }
    const mockStore = {}

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
    canUseDataset.mockResolvedValue(true)
    getStore.mockResolvedValue(mockStore)
    createRecord.mockResolvedValue({ id: 'record123' })

    const result = await executeDatasetAction(
      'Record text',
      { record: true, create: true, datasetId: 'dataset123' },
      { userId: 'user123' }
    )

    expect(result).toEqual({
      result: { id: 'record123' },
      messages: [],
    })
  })

  it('should execute record delete operation', async () => {
    const { deleteRecord } = require('./record')
    const { getStore } = require('./store.types')
    const { canUseDataset } = require('./dataset.access')

    const mockDataset = { id: 'dataset123' }
    const mockStore = {}

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
    canUseDataset.mockResolvedValue(true)
    getStore.mockResolvedValue(mockStore)
    deleteRecord.mockResolvedValue(undefined)

    const result = await executeDatasetAction(
      '',
      { record: true, delete: true, datasetId: 'dataset123', recordId: 'rec1' },
      { userId: 'user123' }
    )

    expect(result).toEqual({
      result: { id: 'rec1' },
      messages: [],
    })
  })

  it('should support id alias for datasetId', async () => {
    const { searchDataset } = require('./dataset.search')
    const { canUseDataset } = require('./dataset.access')

    const mockDataset = { id: 'dataset123' }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
    canUseDataset.mockResolvedValue(true)
    searchDataset.mockResolvedValue([])

    await executeDatasetAction(
      'query',
      { search: '', id: 'dataset123' },
      { userId: 'user123' }
    )

    expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
      { id: 'user123' },
      'dataset123'
    )
  })

  it('should throw error for unknown operation', async () => {
    await expect(
      executeDatasetAction('', {}, { userId: 'user123' })
    ).rejects.toThrow('Unknown operation')
  })

  it('should throw error when datasetId is missing for search', async () => {
    await expect(
      executeDatasetAction('query', { search: true }, { userId: 'user123' })
    ).rejects.toThrow("Missing 'datasetId' parameter")
  })

  it('should throw error when dataset not found', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      executeDatasetAction(
        'query',
        { search: true, datasetId: 'nonexistent' },
        { userId: 'user123' }
      )
    ).rejects.toThrow('Dataset not found')
  })

  it('should throw error when user cannot use dataset', async () => {
    const { canUseDataset } = require('./dataset.access')

    const mockDataset = { id: 'dataset123' }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
    canUseDataset.mockResolvedValue(false)

    await expect(
      executeDatasetAction(
        'query',
        { search: true, datasetId: 'dataset123' },
        { userId: 'user123' }
      )
    ).rejects.toThrow('Cannot use dataset')
  })
})
