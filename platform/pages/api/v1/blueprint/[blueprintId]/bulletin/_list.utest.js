/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import { listBlueprintBulletins } from '@/lib/blueprint.bulletin'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/blueprint.bulletin', () => ({
  listBlueprintBulletins: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, name) => req.query[name]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('GET /api/v1/blueprint/{blueprintId}/bulletin/list', () => {
  const session = { user: { id: 'user-1' } }

  const blueprint = { id: 'bpt-1', userId: 'user-1' }

  const bulletins = [
    { id: 'b-1', text: 'first', createdAt: 1, expiresAt: 10 },
    { id: 'b-2', text: 'second', createdAt: 2, expiresAt: 10 },
    { id: 'b-3', text: 'third', createdAt: 3, expiresAt: 10 },
  ]

  beforeEach(() => {
    mockReset(prisma)
    listBlueprintBulletins.mockReset()
  })

  describe('authorization', () => {
    it('throws when the blueprint does not exist', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        handler(undefined, { query: { blueprintId: 'bpt-1' } }, null, session)
      ).rejects.toThrow()

      expect(listBlueprintBulletins).not.toHaveBeenCalled()
    })

    it('throws when the blueprint belongs to another user', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        ...blueprint,
        userId: 'user-2',
      })

      await expect(
        handler(undefined, { query: { blueprintId: 'bpt-1' } }, null, session)
      ).rejects.toThrow()

      expect(listBlueprintBulletins).not.toHaveBeenCalled()
    })
  })

  describe('listing', () => {
    it('returns all bulletins as items on the first page', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
      listBlueprintBulletins.mockResolvedValue(bulletins)

      const result = await handler(
        undefined,
        { query: { blueprintId: 'bpt-1' } },
        null,
        session
      )

      expect(result.items).toEqual(bulletins)
      expect(listBlueprintBulletins).toHaveBeenCalledWith('bpt-1')
    })

    it('pages in-memory using the cursor (returns items after the cursor id)', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
      listBlueprintBulletins.mockResolvedValue(bulletins)

      const result = await handler(
        'b-1',
        { query: { blueprintId: 'bpt-1' } },
        null,
        session
      )

      expect(result.items.map((b) => b.id)).toEqual(['b-2', 'b-3'])
    })

    it('returns an empty page when the cursor is the last item', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
      listBlueprintBulletins.mockResolvedValue(bulletins)

      const result = await handler(
        'b-3',
        { query: { blueprintId: 'bpt-1' } },
        null,
        session
      )

      expect(result.items).toEqual([])
    })

    it('terminates (empty page) when the cursor id is no longer present', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
      listBlueprintBulletins.mockResolvedValue(bulletins)

      const result = await handler(
        'expired-id',
        { query: { blueprintId: 'bpt-1' } },
        null,
        session
      )

      expect(result.items).toEqual([])
    })
  })
})
