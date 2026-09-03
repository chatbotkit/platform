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
      blueprint: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubBlueprintPage: {
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

describe('/api/v1/hub/blueprint/[blueprintId]/publish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { blueprintId: 'bp_1' } }

  const blueprint = {
    id: 'bp_1',
    userId: 'user_1',
    name: 'My Blueprint',
    description: 'An agent blueprint',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectContentAbuse.mockResolvedValue({ flagged: false, categories: [] })
    isVip.mockReturnValue(false)
  })

  it('returns 404 when blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubBlueprintPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when blueprint belongs to a different user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      ...blueprint,
      userId: 'other_user',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubBlueprintPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when content moderation flags the content', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    detectContentAbuse.mockResolvedValue({
      flagged: true,
      categories: ['violence', 'hate/threatening'],
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 400,
      body: 'Improper entry violating categories: violence, hate/threatening',
    })
    expect(prisma.hubBlueprintPage.upsert).not.toHaveBeenCalled()
  })

  it('publishes with rank 0 for a regular (non-VIP) user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(false)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', blueprintId: 'bp_1' },
    })

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(0)
    expect(upsertCall.update.rank).toBe(0)
  })

  it('publishes with rank 1000 for a VIP user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(true)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', blueprintId: 'bp_1' },
    })

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(1000)
    expect(upsertCall.update.rank).toBe(1000)
  })

  it('falls back to blueprint name and description when body fields are absent', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe(blueprint.name)
    expect(upsertCall.create.description).toBe(blueprint.description)
    expect(upsertCall.update.name).toBe(blueprint.name)
    expect(upsertCall.update.description).toBe(blueprint.description)
  })

  it('includes shareLog in the upsert payload with its default value', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    // @note shareLog is unique to blueprint publish; defaults to false
    expect(upsertCall.create).toHaveProperty('shareLog')
    expect(upsertCall.update).toHaveProperty('shareLog')
  })

  it('includes shareLog=true in upsert when explicitly set', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, { shareLog: true })

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.shareLog).toBe(true)
    expect(upsertCall.update.shareLog).toBe(true)
  })

  it('upserts with correct blueprintId as the where condition', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(blueprint)
    prisma.hubBlueprintPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubBlueprintPage.upsert.mock.calls[0][0]

    expect(upsertCall.where).toEqual({ blueprintId: blueprint.id })
    expect(upsertCall.create.blueprintId).toBe(blueprint.id)
    expect(upsertCall.create.userId).toBe(session.user.id)
  })

  it('propagates database lookup errors', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockRejectedValue(
      new Error('db error')
    )

    await expect(handler(req, session, {})).rejects.toThrow('db error')
  })
})
