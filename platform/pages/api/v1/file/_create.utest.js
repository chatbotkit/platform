/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    file: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
}))

describe('POST /api/v1/file/create', () => {
  const mockSession = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.file.create.mockResolvedValue({ id: 'file-abc123' })
  })

  describe('basic file creation', () => {
    it('creates a file and returns its id', async () => {
      const body = { name: 'My Doc', description: 'A document' }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'file-abc123' })
    })

    it('passes userId from session to prisma', async () => {
      await handler({}, mockSession, { name: 'Test' })

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        })
      )
    })

    it('selects only the id field for the response', async () => {
      await handler({}, mockSession, {})

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
        })
      )
    })
  })

  describe('optional fields', () => {
    it('passes name and description to prisma', async () => {
      const body = { name: 'Report Q4', description: 'Quarterly report' }

      await handler({}, mockSession, body)

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Report Q4',
            description: 'Quarterly report',
          }),
        })
      )
    })

    it('passes visibility to prisma', async () => {
      const body = { visibility: 'public' }

      await handler({}, mockSession, body)

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visibility: 'public' }),
        })
      )
    })

    it('passes meta to prisma', async () => {
      const body = { meta: { source: 'upload', tags: ['docs'] } }

      await handler({}, mockSession, body)

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: { source: 'upload', tags: ['docs'] },
          }),
        })
      )
    })

    it('passes blueprintId to prisma when provided as a string', async () => {
      const body = { blueprintId: 'blueprint-xyz' }

      await handler({}, mockSession, body)

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint-xyz',
          }),
        })
      )
    })

    it('passes alias to prisma', async () => {
      const body = { alias: 'my-alias' }

      await handler({}, mockSession, body)

      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ alias: 'my-alias' }),
        })
      )
    })

    it('creates a file with no optional fields when body is empty', async () => {
      const result = await handler({}, mockSession, {})

      expect(prisma.file.create).toHaveBeenCalledTimes(1)
      expect(result.status).toBe(200)
    })
  })
})
