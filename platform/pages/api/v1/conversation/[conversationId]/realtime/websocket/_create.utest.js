/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, {
  createConversationRealtimeWebsocketSession,
  createRealtimeWebsocketConversation,
} from './create'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

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

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/realtime.session', () => ({
  createRealtimeRelayChannelId: jest.fn(),
  createRealtimeRelayChannelUrl: jest.fn(),
}))

jest.mock('@/pages/api/v1/conversation/[conversationId]/queue', () => ({
  REALTIME_EVENT_TYPE: 'realtime',
  sendEvent: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((_req, param) => _req.query?.[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
}))

// -----------------------------------------------------------------------------
// Imports (after mocks)
// -----------------------------------------------------------------------------

const prisma = require('@/prisma/client').default
const {
  createRealtimeRelayChannelId,
  createRealtimeRelayChannelUrl,
} = require('@/lib/realtime.session')
const {
  sendEvent,
} = require('@/pages/api/v1/conversation/[conversationId]/queue')
const { ok, notFound, notAuthorized } = require('@/lib/response')

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeSession(userId = 'user-1') {
  return {
    user: { id: userId },
    valueOf: jest.fn(() => ({ userId, token: 'tok-1' })),
  }
}

// -----------------------------------------------------------------------------
// Tests: createRealtimeWebsocketConversation
// -----------------------------------------------------------------------------

describe('createRealtimeWebsocketConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createRealtimeRelayChannelId.mockReturnValue('channel-abc')
    createRealtimeRelayChannelUrl.mockImplementation(
      (channelId, side) =>
        `wss://relay.example.com/channel/${channelId}?side=${side}`
    )
    sendEvent.mockResolvedValue(undefined)
  })

  it('creates relay channel and returns the client URL', async () => {
    const session = makeSession()
    const result = await createRealtimeWebsocketConversation({
      conversationId: 'conv-1',
      userId: 'user-1',
      durationInSeconds: 3600,
      session,
    })

    expect(createRealtimeRelayChannelId).toHaveBeenCalledTimes(1)
    expect(result).toBe(
      'wss://relay.example.com/channel/channel-abc?side=client'
    )
  })

  it('calls createRealtimeRelayChannelUrl for both client and runner sides', async () => {
    const session = makeSession()

    await createRealtimeWebsocketConversation({
      conversationId: 'conv-1',
      userId: 'user-1',
      durationInSeconds: 3600,
      session,
    })

    expect(createRealtimeRelayChannelUrl).toHaveBeenCalledWith(
      'channel-abc',
      'client',
      {
        events: true,
      }
    )
    expect(createRealtimeRelayChannelUrl).toHaveBeenCalledWith(
      'channel-abc',
      'runner',
      {
        events: true,
      }
    )
  })

  it('sends a realtime event with channel info and session payload', async () => {
    const session = makeSession()
    const sessionPayload = { userId: 'user-1', token: 'tok-1' }

    session.valueOf.mockReturnValue(sessionPayload)

    createRealtimeRelayChannelUrl.mockImplementation((channelId, side) => {
      if (side === 'client') {
        return `wss://relay/client`
      }

      if (side === 'runner') {
        return `wss://relay/runner`
      }
    })

    await createRealtimeWebsocketConversation({
      conversationId: 'conv-1',
      userId: 'user-1',
      durationInSeconds: 3600,
      session,
    })

    expect(sendEvent).toHaveBeenCalledTimes(1)

    const [convId, event] = sendEvent.mock.calls[0]

    expect(convId).toBe('conv-1')
    expect(event.type).toBe('realtime')
    expect(event.payload.session).toEqual(sessionPayload)
    expect(event.payload.relay.channelId).toBe('channel-abc')
    expect(event.payload.relay.clientUrl).toBe('wss://relay/client')
    expect(event.payload.relay.runnerUrl).toBe('wss://relay/runner')
  })

  it('sets expiresAt based on durationInSeconds', async () => {
    const session = makeSession()
    const before = Date.now()
    const duration = 1800

    await createRealtimeWebsocketConversation({
      conversationId: 'conv-1',
      userId: 'user-1',
      durationInSeconds: duration,
      session,
    })

    const [, event] = sendEvent.mock.calls[0]
    const after = Date.now()

    expect(event.payload.expiresAt).toBeGreaterThanOrEqual(
      before + duration * 1000
    )
    expect(event.payload.expiresAt).toBeLessThanOrEqual(after + duration * 1000)
  })
})

// -----------------------------------------------------------------------------
// Tests: createConversationRealtimeWebsocketSession
// -----------------------------------------------------------------------------

describe('createConversationRealtimeWebsocketSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createRealtimeRelayChannelId.mockReturnValue('channel-xyz')
    createRealtimeRelayChannelUrl.mockImplementation(
      (channelId, side) =>
        `wss://relay.example.com/channel/${channelId}?side=${side}`
    )
    sendEvent.mockResolvedValue(undefined)
  })

  it('defaults durationInSeconds to ONE_HOUR_IN_SECONDS when null', async () => {
    const session = makeSession()
    const conversation = { id: 'conv-1', userId: 'user-1' }

    const result = await createConversationRealtimeWebsocketSession({
      session,
      conversation,
      durationInSeconds: null,
    })

    // ONE_HOUR_IN_SECONDS = 3600; expiresAt should be ~1 hour from now
    const expectedMin = Date.now() + 3600 * 1000 - 100
    const expectedMax = Date.now() + 3600 * 1000 + 5000

    expect(result.expiresAt).toBeGreaterThan(expectedMin)
    expect(result.expiresAt).toBeLessThan(expectedMax)
  })

  it('defaults durationInSeconds to ONE_HOUR_IN_SECONDS when undefined', async () => {
    const session = makeSession()
    const conversation = { id: 'conv-1', userId: 'user-1' }

    const result = await createConversationRealtimeWebsocketSession({
      session,
      conversation,
    })

    const expectedMin = Date.now() + 3600 * 1000 - 100
    const expectedMax = Date.now() + 3600 * 1000 + 5000

    expect(result.expiresAt).toBeGreaterThan(expectedMin)
    expect(result.expiresAt).toBeLessThan(expectedMax)
  })

  it('uses explicit durationInSeconds when provided', async () => {
    const session = makeSession()
    const conversation = { id: 'conv-1', userId: 'user-1' }
    const duration = 7200

    const before = Date.now()
    const result = await createConversationRealtimeWebsocketSession({
      session,
      conversation,
      durationInSeconds: duration,
    })
    const after = Date.now()

    expect(result.expiresAt).toBeGreaterThanOrEqual(before + duration * 1000)
    expect(result.expiresAt).toBeLessThanOrEqual(after + duration * 1000)
  })

  it('returns id equal to conversation.id', async () => {
    const session = makeSession()
    const conversation = { id: 'conv-42', userId: 'user-1' }

    const result = await createConversationRealtimeWebsocketSession({
      session,
      conversation,
      durationInSeconds: 3600,
    })

    expect(result.id).toBe('conv-42')
  })

  it('returns websocket URL from createRealtimeWebsocketConversation', async () => {
    const session = makeSession()
    const conversation = { id: 'conv-1', userId: 'user-1' }

    createRealtimeRelayChannelUrl.mockImplementation((channelId, side) => {
      if (side === 'client') {
        return 'wss://relay/client-side'
      }

      return 'wss://relay/runner-side'
    })

    const result = await createConversationRealtimeWebsocketSession({
      session,
      conversation,
      durationInSeconds: 3600,
    })

    expect(result.websocket).toBe('wss://relay/client-side')
  })
})

// -----------------------------------------------------------------------------
// Tests: HTTP handler (default export)
// -----------------------------------------------------------------------------

describe('handler (default export)', () => {
  const mockConversationId = 'conv-http-1'

  function makeReq(_userId = 'user-1', durationInSeconds = null) {
    return {
      query: { conversationId: mockConversationId },
      body: { durationInSeconds },
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    createRealtimeRelayChannelId.mockReturnValue('channel-handler')
    createRealtimeRelayChannelUrl.mockImplementation(
      (channelId, side) => `wss://relay/${side}`
    )
    sendEvent.mockResolvedValue(undefined)
  })

  it('returns notFound when conversation does not exist', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    const session = makeSession('user-1')
    const req = makeReq('user-1')

    const result = await handler(req, session, req.body)

    expect(notFound).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(404)
  })

  it('returns notAuthorized when conversation belongs to different user', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: mockConversationId,
      userId: 'other-user',
    })

    const session = makeSession('user-1')
    const req = makeReq('user-1')

    const result = await handler(req, session, req.body)

    expect(notAuthorized).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(403)
  })

  it('returns ok with session data when conversation belongs to session user', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: mockConversationId,
      userId: 'user-1',
    })

    const session = makeSession('user-1')
    const req = {
      query: { conversationId: mockConversationId },
      body: { durationInSeconds: 3600 },
    }

    const result = await handler(req, session, req.body)

    expect(ok).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(200)
    expect(result.data.id).toBe(mockConversationId)
    expect(result.data.websocket).toBeDefined()
    expect(result.data.expiresAt).toBeGreaterThan(Date.now())
  })

  it('uses ONE_HOUR_IN_SECONDS as default when durationInSeconds is null', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: mockConversationId,
      userId: 'user-1',
    })

    const session = makeSession('user-1')
    const req = {
      query: { conversationId: mockConversationId },
      body: { durationInSeconds: null },
    }

    const result = await handler(req, session, req.body)

    expect(result.status).toBe(200)

    // expiresAt should be around 1 hour from now
    const hourFromNow = Date.now() + 3600 * 1000

    expect(result.data.expiresAt).toBeGreaterThan(hourFromNow - 5000)
    expect(result.data.expiresAt).toBeLessThan(hourFromNow + 5000)
  })

  it('queries prisma for the correct conversationId', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    const session = makeSession('user-1')
    const req = makeReq('user-1')

    await handler(req, session, req.body)

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: { id: mockConversationId },
      select: { id: true, userId: true },
    })
  })
})
