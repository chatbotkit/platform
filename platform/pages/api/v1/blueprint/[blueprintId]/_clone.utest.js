/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'

import handler from './clone'

let cuidIndex = 0

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    blueprint: { create: jest.fn(), update: jest.fn() },
    secret: { create: jest.fn() },
    file: { create: jest.fn() },
    dataset: { create: jest.fn() },
    skillset: { create: jest.fn() },
    space: { create: jest.fn() },
    ability: { create: jest.fn() },
    bot: { create: jest.fn() },
    policy: { create: jest.fn() },
    portal: { create: jest.fn() },
    oAuthConnection: { create: jest.fn() },
    extractIntegration: { create: jest.fn() },
    notionIntegration: { create: jest.fn() },
    sitemapIntegration: { create: jest.fn() },
    supportIntegration: { create: jest.fn() },
    emailIntegration: { create: jest.fn() },
    triggerIntegration: { create: jest.fn() },
    widgetIntegration: { create: jest.fn() },
    slackIntegration: { create: jest.fn() },
    discordIntegration: { create: jest.fn() },
    telegramIntegration: { create: jest.fn() },
    whatsappIntegration: { create: jest.fn() },
    messengerIntegration: { create: jest.fn() },
    instagramIntegration: { create: jest.fn() },
    twilioIntegration: { create: jest.fn() },
    mcpserverIntegration: { create: jest.fn() },
  },
}))

jest.mock('@/lib/cuid', () => ({
  cuid: jest.fn(() => {
    cuidIndex += 1

    return `cuid-${cuidIndex}`
  }),
}))

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
  requiredUrlParam: jest.fn(
    (req, key) => req.params?.[key] ?? req.query?.[key]
  ),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  conflict: () => ({ status: 409 }),
}))

jest.mock('@/lib/blueprint.resources', () => ({
  getBlueprintAndCloneableResources: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn((base, sep) => `${base}${sep}random`),
}))

function makeData({ blueprint = {}, resources = {} } = {}) {
  return {
    blueprint: {
      id: 'bp-1',
      userId: 'user-1',
      name: 'My Blueprint',
      description: 'desc',
      hubBlueprintPage: null,
      config: null,
      ...blueprint,
    },
    resources: {
      basic: {},
      object: {},
      compliance: {},
      oauth: {},
      integration: {},
      ...resources,
    },
  }
}

describe('/api/v1/blueprint/[blueprintId]/clone', () => {
  const mockSession = { user: { id: 'user-1' } }
  const mockReq = { params: { blueprintId: 'bp-1' }, query: {} }

  beforeEach(() => {
    jest.clearAllMocks()
    cuidIndex = 0

    // @note the transaction runs the callback against the mock client itself,
    // so `tx.<model>.create` resolves to the mocked delegates
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma))
  })

  it('returns 404 when the blueprint does not exist', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(null)

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 403 when the blueprint belongs to another user and is not public', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(
      makeData({ blueprint: { userId: 'other-user', hubBlueprintPage: null } })
    )

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('allows cloning a public blueprint owned by another user', async () => {
    const data = makeData({
      blueprint: { userId: 'other-user', hubBlueprintPage: { id: 'hub-1' } },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(data)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'new-bp-1' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).not.toBe(403)
    expect(result.status).not.toBe(404)
  })

  it('clones an owned (empty) blueprint and returns the new id', async () => {
    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(makeData())
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'new-bp-2' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)
    expect(result.body.id).toBe('new-bp-2')
    // no resources → no importing, but the target is still created atomically
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.bot.create).not.toHaveBeenCalled()
  })

  it('re-maps references so a cloned bot points at the cloned dataset', async () => {
    const source = makeData({
      resources: {
        basic: {
          dataset: [{ id: 'ds-orig', name: 'DS', description: '' }],
          bot: [
            {
              id: 'bot-orig',
              name: 'Bot',
              description: '',
              datasetId: 'ds-orig',
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.dataset.create.mockResolvedValue({ id: 'ds-new' })
    prisma.bot.create.mockResolvedValue({ id: 'bot-new' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)
    expect(prisma.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ datasetId: 'ds-new' }),
      })
    )
  })

  it('clones a policy and resolves its botId to the cloned bot', async () => {
    const source = makeData({
      resources: {
        basic: {
          bot: [{ id: 'bot-orig', name: 'Bot', description: '' }],
        },
        compliance: {
          policy: [
            {
              id: 'pol-orig',
              name: 'Guard',
              description: '',
              type: 'usage',
              botId: 'bot-orig',
              config: {
                metric: 'tokens',
                threshold: 100,
                windowInSeconds: 600,
                actions: { block: { durationInSeconds: 600 } },
              },
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.bot.create.mockResolvedValue({ id: 'bot-new' })
    prisma.policy.create.mockResolvedValue({ id: 'pol-new' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)
    expect(prisma.policy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botId: 'bot-new',
          blueprintId: 'bp-new',
          userId: 'user-1',

          // @note the config must round-trip intact: it used to be parsed
          // through the loose PolicyConfig union, whose retention branch
          // matches any object and stripped a usage config to `{}`
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { block: { durationInSeconds: 600 } },
          },
        }),
      })
    )
  })

  it('excludes secret values when cloning', async () => {
    const source = makeData({
      resources: {
        basic: {
          secret: [
            {
              id: 'sec-orig',
              name: 'API Key',
              description: '',
              value: 'super-secret-value',
              config: {
                clientId: 'client-id',
                clientSecret: 'nested-client-secret',
                password: 'nested-password',
              },
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.secret.create.mockResolvedValue({ id: 'sec-new' })

    await handler(mockReq, mockSession, {})

    const data = prisma.secret.create.mock.calls[0][0].data

    expect(data).not.toHaveProperty('value')
    expect(data).not.toHaveProperty('config')
  })

  it('mints a replacement notion token when cloning', async () => {
    const source = makeData({
      resources: {
        integration: {
          notion: [
            {
              id: 'notion-orig',
              name: 'Notion',
              description: '',
              token: 'source-notion-token',
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.notionIntegration.create.mockResolvedValue({ id: 'notion-new' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)

    const data = prisma.notionIntegration.create.mock.calls[0][0].data

    expect(typeof data.token).toBe('string')
    expect(data.token).not.toBe('source-notion-token')
    expect(data.token.length).toBeGreaterThan(0)
  })

  it('strips integration credentials when cloning (not just secret values)', async () => {
    const source = makeData({
      resources: {
        integration: {
          slack: [
            {
              id: 'slk-orig',
              name: 'Slack',
              description: '',
              signingSecret: 'super-signing',
              botToken: 'xoxb-super',
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.slackIntegration.create.mockResolvedValue({ id: 'slk-new' })

    await handler(mockReq, mockSession, {})

    const data = prisma.slackIntegration.create.mock.calls[0][0].data

    expect(data).not.toHaveProperty('signingSecret')
    expect(data).not.toHaveProperty('botToken')
  })

  it('does not clone oAuthConnections (reference-only, never an import category)', async () => {
    const source = makeData({
      resources: {
        basic: { bot: [{ id: 'bot-orig', name: 'Bot', description: '' }] },
        oauth: {
          oAuthConnection: [{ id: 'oa-orig', name: 'Conn', description: '' }],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.bot.create.mockResolvedValue({ id: 'bot-new' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)
    expect(prisma.bot.create).toHaveBeenCalled()
    expect(prisma.oAuthConnection.create).not.toHaveBeenCalled()
  })

  it('does not carry the source owner oAuthConnection into a cloned mcpserver integration', async () => {
    // @note cloning a PUBLIC hub blueprint owned by another user. Its mcpserver
    // integration references the SOURCE OWNER's oAuthConnection. The clone must
    // null that cross-tenant FK - otherwise the cloner's integration would drive
    // its OAuth flow against the source owner's IdP client credentials.
    const source = makeData({
      blueprint: {
        userId: 'other-user',
        hubBlueprintPage: { id: 'hub-1' },
      },
      resources: {
        integration: {
          mcpserver: [
            {
              id: 'mcp-orig',
              name: 'MCP',
              description: '',
              oAuthConnectionId: 'oac-owned-by-other-user',
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-new' })

    const result = await handler(mockReq, mockSession, {})

    expect(result.status).toBe(200)

    const data = prisma.mcpserverIntegration.create.mock.calls[0][0].data

    expect(data).not.toHaveProperty('oAuthConnectionId')
  })

  it('returns conflict (nothing committed) when a resource fails to clone', async () => {
    const source = makeData({
      resources: {
        basic: { bot: [{ id: 'bot-orig', name: 'Bot', description: '' }] },
      },
    })

    getBlueprintAndCloneableResources.mockResolvedValueOnce(source)

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.bot.create.mockRejectedValue(new Error('db failure'))

    const result = await handler(mockReq, mockSession, {})

    // the engine throw is caught; the atomic transaction guarantees rollback
    expect(result.status).toBe(409)
  })

  it('regenerates portal slugs to avoid collisions', async () => {
    const source = makeData({
      resources: {
        basic: {
          portals: [
            {
              id: 'por-orig',
              name: 'Portal',
              description: '',
              slug: 'my-portal',
            },
          ],
        },
      },
    })

    getBlueprintAndCloneableResources
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(makeData())

    prisma.blueprint.create.mockResolvedValue({ id: 'bp-new' })
    prisma.portal.create.mockResolvedValue({ id: 'por-new' })

    await handler(mockReq, mockSession, {})

    expect(prisma.portal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'my-portal-random' }),
      })
    )
  })
})
