/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { deleteFile } from '@/lib/file.delete'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      file: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/file.delete', () => ({
  deleteFile: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/file/[fileId]/delete', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { fileId: 'file_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes file for owner and returns id', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file_1',
      userId: 'user_1',
    })

    const result = await handler(req, session)

    expect(prisma.file.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'file_1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(deleteFile).toHaveBeenCalledWith({ id: 'file_1', userId: 'user_1' })
    expect(result).toEqual({ status: 200, body: { id: 'file_1' } })
  })

  it('returns 404 when file does not exist', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('returns 401 when file belongs to another user', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file_1',
      userId: 'user_2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('propagates delete errors', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file_1',
      userId: 'user_1',
    })
    deleteFile.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session)).rejects.toThrow('delete failed')
  })
})
