/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('GET /api/v1/skillset/[skillsetId]/ability/[abilityId]/fetch', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1', abilityId: 'ab-1' } }

  const ability = {
    id: 'ab-1',
    name: 'Fetch Weather',
    description: 'Gets weather data',
    instruction: '```fetch\nGET https://example.com\n```',
    blueprintId: null,
    skillsetId: 'ss-1',
    linkedSecretId: null,
    linkedFileId: null,
    linkedBotId: null,
    linkedSpaceId: null,
    meta: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
      abilities: [ability],
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('returns 404 when ability is not in the skillset', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [],
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns ability data when found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [ability],
    })

    const result = await handler(req, session)

    expect(result.status).toBe(200)
    expect(result.body.id).toBe('ab-1')
    expect(result.body.name).toBe('Fetch Weather')
    expect(result.body.instruction).toBe(
      '```fetch\nGET https://example.com\n```'
    )
  })

  it('calls findUniqueByIdentifier with abilityId in include filter', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    await handler(req, session)

    expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'ss-1',
      expect.objectContaining({
        include: expect.objectContaining({
          abilities: expect.objectContaining({
            where: { id: 'ab-1' },
          }),
        }),
      })
    )
  })
})
