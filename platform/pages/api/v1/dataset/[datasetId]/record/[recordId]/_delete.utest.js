/**
 * @jest-environment node
 */
import { deleteRecord } from '@/lib/record'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const getStore = jest.fn()

jest.mock('@/lib/store.types', () => ({
  getStore: (...args) => getStore(...args),
}))

jest.mock('@/lib/record', () => ({
  deleteRecord: jest.fn(),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/dataset/[datasetId]/record/[recordId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1', recordId: 'record-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when dataset does not exist', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(getStore).not.toHaveBeenCalled()
    expect(deleteRecord).not.toHaveBeenCalled()
  })

  it('returns 401 when dataset belongs to another user', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'dataset-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(getStore).not.toHaveBeenCalled()
  })

  it('returns 404 when record cannot be accessed', async () => {
    const store = {
      accessRecord: jest.fn().mockRejectedValue(new Error('missing')),
    }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'dataset-1',
      userId: 'user-1',
    })
    getStore.mockResolvedValue(store)

    const result = await handler(req, session)

    expect(store.accessRecord).toHaveBeenCalledWith({
      datasetId: 'dataset-1',
      recordId: 'record-1',
    })
    expect(result).toEqual({ status: 404 })
    expect(deleteRecord).not.toHaveBeenCalled()
  })

  it('deletes record and returns deleted id', async () => {
    const store = {
      accessRecord: jest.fn().mockResolvedValue({ id: 'record-1' }),
    }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'dataset-1',
      userId: 'user-1',
    })
    getStore.mockResolvedValue(store)

    const result = await handler(req, session)

    expect(deleteRecord).toHaveBeenCalledWith({
      store,
      datasetId: 'dataset-1',
      recordId: 'record-1',
    })
    expect(result).toEqual({ status: 200, body: { id: 'record-1' } })
  })
})
