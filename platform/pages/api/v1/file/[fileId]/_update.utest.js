/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      file: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

const prisma = require('@/prisma/client').default

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, _prev) => meta ?? {}),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

const { getMeta } = require('@/lib/meta')

describe('POST /api/v1/file/[fileId]/update', () => {
  const session = { user: { id: 'user_1' } }

  function makeReq(fileId = 'file_1') {
    return { query: { fileId } }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.file.update.mockResolvedValue(undefined)
  })

  describe('authorization', () => {
    it('returns 404 when the file does not exist', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(makeReq(), session, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.file.update).not.toHaveBeenCalled()
    })

    it('returns 403 when the file belongs to a different user', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_2',
      })

      const result = await handler(makeReq(), session, {})

      expect(result).toEqual({ status: 403 })
      expect(prisma.file.update).not.toHaveBeenCalled()
    })
  })

  describe('successful update', () => {
    beforeEach(() => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_1',
        meta: { existing: 'value' },
      })
    })

    it('returns 200 with the file id on successful update', async () => {
      const result = await handler(makeReq(), session, { name: 'New Name' })

      expect(result).toEqual({ status: 200, body: { id: 'file_1' } })
    })

    it('calls prisma.file.update with where clause using the found file id', async () => {
      await handler(makeReq(), session, { name: 'New Name' })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'file_1' },
        })
      )
    })

    it('passes name and description to the update', async () => {
      await handler(makeReq(), session, {
        name: 'Updated Name',
        description: 'Updated description',
      })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated Name',
            description: 'Updated description',
          }),
        })
      )
    })

    it('passes visibility to the update', async () => {
      await handler(makeReq(), session, { visibility: 'public' })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'public',
          }),
        })
      )
    })

    it('passes blueprintId string directly to the update', async () => {
      await handler(makeReq(), session, { blueprintId: 'blueprint_abc' })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_abc',
          }),
        })
      )
    })

    it('extracts id from blueprintId object when provided as an object', async () => {
      await handler(makeReq(), session, {
        blueprintId: { id: 'blueprint_abc' },
      })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_abc',
          }),
        })
      )
    })

    it('passes alias to the update', async () => {
      await handler(makeReq(), session, { alias: 'my-alias' })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alias: 'my-alias',
          }),
        })
      )
    })

    it('delegates meta computation to getMeta with body meta and existing file meta', async () => {
      const incomingMeta = { key: 'value' }

      getMeta.mockReturnValue({ merged: true })

      await handler(makeReq(), session, { meta: incomingMeta })

      expect(getMeta).toHaveBeenCalledWith(incomingMeta, { existing: 'value' })

      expect(prisma.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: { merged: true },
          }),
        })
      )
    })

    it('uses the query fileId to look up the file', async () => {
      await handler(makeReq('file_xyz'), session, {})

      expect(prisma.file.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'file_xyz'
      )
    })
  })

  describe('partial update semantics', () => {
    beforeEach(() => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_1',
        meta: null,
      })
    })

    it('does not fail when called with an empty body', async () => {
      const result = await handler(makeReq(), session, {})

      expect(result).toEqual({ status: 200, body: { id: 'file_1' } })
    })
  })
})
