/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
      ability: {
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/skillset/[skillsetId]/ability/[abilityId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1', abilityId: 'ab-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.ability.delete.mockResolvedValue({ id: 'ab-1' })
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.delete).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
      abilities: [{ id: 'ab-1' }],
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(prisma.ability.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when ability is not found in the skillset', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [],
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.delete).not.toHaveBeenCalled()
  })

  it('deletes the ability and returns its id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [{ id: 'ab-1' }],
    })

    const result = await handler(req, session)

    expect(prisma.ability.delete).toHaveBeenCalledWith({
      where: { id: 'ab-1' },
    })
    expect(result).toEqual({ status: 200, body: { id: 'ab-1' } })
  })

  it('deletes the ability found via nested include, not the URL param directly', async () => {
    // @note the handler looks up the ability via nested include on skillset,
    // so the deleted id comes from the DB record, not directly from the URL
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [{ id: 'ab-db-id' }],
    })

    const result = await handler(req, session)

    expect(prisma.ability.delete).toHaveBeenCalledWith({
      where: { id: 'ab-db-id' },
    })
    expect(result).toEqual({ status: 200, body: { id: 'ab-db-id' } })
  })
})
