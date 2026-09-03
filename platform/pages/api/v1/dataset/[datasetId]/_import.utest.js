/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { config } from './import'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withFormDataPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/zlib', () => ({
  gzip: jest.fn(() => new Uint8Array([1, 2, 3])),
}))

jest.mock('@/lib/b64', () => ({
  encodeUint8Array: jest.fn(() => 'encoded-data-zb64'),
}))

jest.mock('@/pages/api/v1/dataset/[datasetId]/queue', () => ({
  sendEvent: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { getUploadFile } = require('@/lib/upload')
const { sendEvent } = require('@/pages/api/v1/dataset/[datasetId]/queue')

describe('POST /api/v1/dataset/[datasetId]/import', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'ds-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns not found when dataset does not exist', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session)

    expect(response).toEqual({ status: 404 })
    expect(getUploadFile).not.toHaveBeenCalled()
  })

  it('returns not authorized when dataset belongs to another user', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds-1',
      userId: 'other-user',
    })

    const response = await handler(req, session)

    expect(response).toEqual({ status: 401 })
    expect(getUploadFile).not.toHaveBeenCalled()
  })

  it('imports uploaded dataset content and queues importBlob event', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds-1',
      userId: 'user-1',
    })

    getUploadFile.mockResolvedValue({
      name: 'dataset.json',
      type: 'application/json',
      arrayBuffer: jest.fn(async () => new Uint8Array([7, 8, 9]).buffer),
    })

    const response = await handler(req, session)

    expect(sendEvent).toHaveBeenCalledWith('ds-1', {
      type: 'importBlob',
      payload: {
        dataZB64: 'encoded-data-zb64',
        name: 'dataset.json',
        type: 'application/json',
      },
    })
    expect(response).toEqual({ status: 200, body: { id: 'ds-1' } })
  })

  it('disables body parser for form data uploads', () => {
    expect(config).toEqual({ api: { bodyParser: false } })
  })
})
