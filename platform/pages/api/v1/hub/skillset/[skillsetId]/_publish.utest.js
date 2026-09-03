/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { detectContentAbuse } from '@/lib/moderation'
import { isVip } from '@/lib/user.type'

import handler from './publish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubSkillsetPage: {
        upsert: jest.fn(),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
  badRequest: (msg) => ({ status: 400, body: msg }),
}))

jest.mock('@/lib/moderation', () => ({
  detectContentAbuse: jest.fn(),
}))

jest.mock('@/lib/user.type', () => ({
  isVip: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  joinTrimmedNotEmpty: jest.fn((...args) =>
    args[0].filter(Boolean).join('\n\n')
  ),
}))

describe('/api/v1/hub/skillset/[skillsetId]/publish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { skillsetId: 'skillset_1' } }

  const skillset = {
    id: 'skillset_1',
    userId: 'user_1',
    name: 'My Skillset',
    description: 'A useful set of skills',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectContentAbuse.mockResolvedValue({ flagged: false, categories: [] })
    isVip.mockReturnValue(false)
  })

  it('returns 404 when skillset does not exist', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubSkillsetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      ...skillset,
      userId: 'other_user',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubSkillsetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when content moderation flags the content', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    detectContentAbuse.mockResolvedValue({
      flagged: true,
      categories: ['harassment'],
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 400,
      body: 'Improper entry violating categories: harassment',
    })
    expect(prisma.hubSkillsetPage.upsert).not.toHaveBeenCalled()
  })

  it('publishes with rank 0 for a regular (non-VIP) user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    prisma.hubSkillsetPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(false)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', skillsetId: 'skillset_1' },
    })

    const upsertCall = prisma.hubSkillsetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(0)
    expect(upsertCall.update.rank).toBe(0)
  })

  it('publishes with rank 1000 for a VIP user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    prisma.hubSkillsetPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(true)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', skillsetId: 'skillset_1' },
    })

    const upsertCall = prisma.hubSkillsetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(1000)
    expect(upsertCall.update.rank).toBe(1000)
  })

  it('falls back to skillset name and description when body fields are absent', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    prisma.hubSkillsetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubSkillsetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe(skillset.name)
    expect(upsertCall.create.description).toBe(skillset.description)
    expect(upsertCall.update.name).toBe(skillset.name)
    expect(upsertCall.update.description).toBe(skillset.description)
  })

  it('uses body name and description when provided, overriding skillset defaults', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    prisma.hubSkillsetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    const body = { name: 'Custom Name', description: 'Custom Desc' }

    await handler(req, session, body)

    const upsertCall = prisma.hubSkillsetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe('Custom Name')
    expect(upsertCall.create.description).toBe('Custom Desc')
  })

  it('upserts with correct skillsetId as the where condition', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)
    prisma.hubSkillsetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubSkillsetPage.upsert.mock.calls[0][0]

    expect(upsertCall.where).toEqual({ skillsetId: skillset.id })
    expect(upsertCall.create.skillsetId).toBe(skillset.id)
    expect(upsertCall.create.userId).toBe(session.user.id)
  })

  it('propagates database lookup errors', async () => {
    prisma.skillset.findUniqueByIdentifier.mockRejectedValue(
      new Error('db error')
    )

    await expect(handler(req, session, {})).rejects.toThrow('db error')
  })
})
