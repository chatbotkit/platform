/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import { verifyGoogleChatToken } from '@/lib/googlechat.auth'
import { logEvent } from '@/lib/log'

import handler from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/event'
import { sendEvent } from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  googlechatIntegration: {
    findUnique: jest.fn(),
  },
}))

jest.mock('@/lib/context.store', () => ({
  getContextRequestHost: jest.fn(),
  getContextRequestProtocol: jest.fn(),
}))

jest.mock('@/lib/googlechat.auth', () => ({
  verifyGoogleChatToken: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const fn = jest.fn(() => ({ log: jest.fn() }))

  fn.warn = jest.fn(() => ({ log: jest.fn() }))

  return { __esModule: true, default: fn, warn: fn.warn }
})

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(
    (req, param) =>
      req.query?.[param] || new URL(req.url).searchParams.get(param)
  ),
}))

describe('Google Chat event API handler', () => {
  const integrationBase = {
    id: 'gc-int-123',
    userId: 'user-123',
    projectNumber: null,
    allowFrom: '*',
    meta: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getContextRequestHost.mockReturnValue(undefined)
    getContextRequestProtocol.mockReturnValue(undefined)
    verifyGoogleChatToken.mockResolvedValue({
      sub: 'chat@system.gserviceaccount.com',
    })
  })

  function makeRequest(
    payload,
    { googlechatIntegrationId = 'gc-int-123', authHeader } = {}
  ) {
    const url = `https://example.com/api/v1/integration/googlechat/${googlechatIntegrationId}/event?googlechatIntegrationId=${googlechatIntegrationId}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body,
    })
  }

  it('returns 404 when integration not found', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(null)

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(404)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('skips JWT verification when projectNumber is not configured', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue({
      ...integrationBase,
      projectNumber: null,
    })

    const req = makeRequest({
      type: 'MESSAGE',
      message: { text: 'hello', sender: { name: 'users/123' }, thread: {} },
      space: { name: 'spaces/abc', type: 'DM' },
    })

    await handler(req)

    expect(verifyGoogleChatToken).not.toHaveBeenCalled()
  })

  it('verifies JWT when projectNumber is configured', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue({
      ...integrationBase,
      projectNumber: '999888777',
    })

    const req = makeRequest(
      {
        type: 'MESSAGE',
        message: { text: 'hello', sender: { name: 'users/123' }, thread: {} },
        space: { name: 'spaces/abc', type: 'DM' },
      },
      { authHeader: 'Bearer test-jwt-token' }
    )

    await handler(req)

    expect(verifyGoogleChatToken).toHaveBeenCalledWith(
      'Bearer test-jwt-token',
      {
        projectNumber: '999888777',
        expectedEndpointUrl:
          'https://example.com/api/v1/integration/googlechat/gc-int-123/event',
      }
    )
  })

  it('uses context host and protocol when reconstructing a relative URL', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue({
      ...integrationBase,
      projectNumber: '999888777',
    })
    getContextRequestHost.mockReturnValue('chat.example.com')
    getContextRequestProtocol.mockReturnValue('http')

    const req = {
      url: '/api/v1/integration/googlechat/gc-int-123/event',
      query: { googlechatIntegrationId: 'gc-int-123' },
      headers: new Headers({
        authorization: 'Bearer test-jwt-token',
        'x-forwarded-proto': 'https',
      }),
      json: jest.fn().mockResolvedValue({ type: 'MESSAGE' }),
    }

    await handler(req)

    expect(verifyGoogleChatToken).toHaveBeenCalledWith(
      'Bearer test-jwt-token',
      {
        projectNumber: '999888777',
        expectedEndpointUrl:
          'http://chat.example.com/api/v1/integration/googlechat/gc-int-123/event',
      }
    )
  })

  it('returns 403 when JWT verification fails', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue({
      ...integrationBase,
      projectNumber: '999888777',
    })

    verifyGoogleChatToken.mockRejectedValue(new Error('invalid token'))

    const req = makeRequest(
      { type: 'MESSAGE' },
      { authHeader: 'Bearer bad-token' }
    )
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 403 on invalid JSON body', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest('not-valid-json')
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('queues interact event for MESSAGE type', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        name: 'spaces/abc/messages/msg-1',
        text: 'Hello bot',
        argumentText: 'Hello bot',
        sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        thread: { name: 'spaces/abc/threads/t1' },
        attachment: [
          {
            name: 'spaces/abc/messages/msg-1/attachments/a1',
            contentName: 'brief.pdf',
            contentType: 'application/pdf',
            source: 'UPLOADED_CONTENT',
            attachmentDataRef: {
              resourceName: 'spaces/abc/messages/msg-1/attachments/a1',
            },
          },
        ],
      },
      space: {
        name: 'spaces/abc',
        displayName: 'My Space',
        type: 'ROOM',
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        senderName: 'users/u1',
        senderDisplayName: 'Alice',
        spaceName: 'spaces/abc',
        spaceDisplayName: 'My Space',
        spaceType: 'ROOM',
        spaceThreadingState: '',
        messageName: 'spaces/abc/messages/msg-1',
        eventTime: '',
        threadName: 'spaces/abc/threads/t1',
        attachments: [
          expect.objectContaining({
            contentName: 'brief.pdf',
            attachmentDataRef: expect.objectContaining({
              resourceName: 'spaces/abc/messages/msg-1/attachments/a1',
            }),
          }),
        ],
        text: 'Hello bot',
      }),
    })
  })

  it('queues Workspace add-on Meet messages with the space threading state', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      chat: {
        user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        eventTime: '2026-05-19T17:21:32.723903Z',
        messagePayload: {
          space: {
            name: 'spaces/meet-room',
            displayName: 'Standup - May 20',
            type: 'ROOM',
            spaceThreadingState: 'UNTHREADED_MESSAGES',
          },
          message: {
            name: 'spaces/meet-room/messages/msg-1.msg-1',
            text: '@Bob hi there',
            argumentText: ' hi there',
            sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
            thread: {
              name: 'spaces/meet-room/threads/msg-1',
            },
          },
        },
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        senderName: 'users/u1',
        spaceName: 'spaces/meet-room',
        spaceType: 'ROOM',
        spaceThreadingState: 'UNTHREADED_MESSAGES',
        threadName: 'spaces/meet-room/threads/msg-1',
        text: 'hi there',
      }),
    })
  })

  it('queues media-only MESSAGE events when attachments are present', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        name: 'spaces/abc/messages/msg-2',
        text: '',
        argumentText: '',
        sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        thread: {},
        attachment: [
          {
            name: 'spaces/abc/messages/msg-2/attachments/a1',
            contentName: 'image.png',
            contentType: 'image/png',
            source: 'UPLOADED_CONTENT',
            attachmentDataRef: {
              resourceName: 'spaces/abc/messages/msg-2/attachments/a1',
            },
          },
        ],
      },
      space: {
        name: 'spaces/abc',
        displayName: 'My Space',
        type: 'DM',
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        text: '',
        attachments: [
          expect.objectContaining({
            contentName: 'image.png',
            attachmentDataRef: expect.objectContaining({
              resourceName: 'spaces/abc/messages/msg-2/attachments/a1',
            }),
          }),
        ],
      }),
    })
  })

  it('queues MESSAGE events with legacy plural attachments field', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        name: 'spaces/abc/messages/msg-3',
        text: 'Please inspect this',
        argumentText: 'Please inspect this',
        sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        attachments: [
          {
            name: 'spaces/abc/messages/msg-3/attachments/a1',
            contentName: 'legacy.pdf',
            contentType: 'application/pdf',
            source: 'UPLOADED_CONTENT',
            attachmentDataRef: {
              resourceName: 'spaces/abc/messages/msg-3/attachments/a1',
            },
          },
        ],
      },
      space: {
        name: 'spaces/abc',
        displayName: 'My Space',
        type: 'ROOM',
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        text: 'Please inspect this',
        attachments: [
          expect.objectContaining({
            contentName: 'legacy.pdf',
            attachmentDataRef: expect.objectContaining({
              resourceName: 'spaces/abc/messages/msg-3/attachments/a1',
            }),
          }),
        ],
      }),
    })
  })

  it('queues slash command MESSAGE events as private command interactions', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
      message: {
        name: 'spaces/abc/messages/msg-4',
        text: '/ask run report',
        argumentText: ' run report',
        sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        thread: { name: 'spaces/abc/threads/t1' },
        slashCommand: {
          commandId: 7,
          type: 'INVOKE',
        },
      },
      space: {
        name: 'spaces/abc',
        displayName: 'My Space',
        type: 'ROOM',
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        senderName: 'users/u1',
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 7,
          commandName: '/ask',
          type: 'INVOKE',
        },
        text: '/ask run report',
      }),
    })
  })

  it('queues no-argument slash commands using the message text fallback', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
      message: {
        name: 'spaces/abc/messages/msg-5',
        text: '/help',
        argumentText: ' ',
        sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        slashCommand: {
          commandId: 8,
          type: 'INVOKE',
        },
      },
      space: {
        name: 'spaces/abc',
        displayName: 'My Space',
        type: 'ROOM',
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 8,
          commandName: '/help',
          type: 'INVOKE',
        },
        text: '/help',
      }),
    })
  })

  it('queues appCommandPayload slash commands from Workspace add-on events', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      chat: {
        user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        eventTime: '2026-05-16T08:07:26.914735Z',
        appCommandPayload: {
          appCommandMetadata: {
            appCommandId: 123,
            appCommandType: 'SLASH_COMMAND',
          },
          space: {
            name: 'spaces/dm1',
            type: 'DM',
          },
          message: {
            name: 'spaces/dm1/messages/msg-6',
            text: '/callbobo hi there',
            argumentText: ' hi there',
            sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
            slashCommand: {
              commandId: 123,
            },
            thread: {
              name: 'spaces/dm1/threads/t1',
            },
          },
        },
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        senderName: 'users/u1',
        spaceName: 'spaces/dm1',
        spaceType: 'DM',
        eventTime: '2026-05-16T08:07:26.914735Z',
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 123,
          commandName: '/callbobo',
          type: 'SLASH_COMMAND',
        },
        text: '/callbobo hi there',
      }),
    })
  })

  it('queues quick commands with a stable command id token', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      chat: {
        user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        appCommandPayload: {
          appCommandMetadata: {
            appCommandId: 55,
            appCommandType: 'QUICK_COMMAND',
          },
          space: {
            name: 'spaces/dm1',
            type: 'DM',
          },
          message: {
            name: 'spaces/dm1/messages/msg-7',
            sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
          },
        },
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 55,
          commandName: '/googlechat-quick-command-55',
          type: 'QUICK_COMMAND',
        },
        text: '/googlechat-quick-command-55',
      }),
    })
  })

  it('enriches quick commands with integration meta command descriptions', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue({
      ...integrationBase,
      meta: {
        googlechat: {
          commands: {
            444: {
              name: 'Daily Brief',
              description: 'Summarise the latest workspace activity.',
              prompt: 'Keep the answer concise and action oriented.',
            },
          },
        },
      },
    })

    const req = makeRequest({
      chat: {
        user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        appCommandPayload: {
          appCommandMetadata: {
            appCommandId: 444,
            appCommandType: 'QUICK_COMMAND',
          },
          space: {
            name: 'spaces/dm1',
            type: 'DM',
          },
          message: {},
        },
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 444,
          commandName: '/daily-brief',
          type: 'QUICK_COMMAND',
        },
        text: [
          '/daily-brief',
          'Command name: Daily Brief',
          'Command description: Summarise the latest workspace activity.',
          'Command instructions: Keep the answer concise and action oriented.',
        ].join('\n\n'),
      }),
    })
  })

  it('queues message actions with the selected message context', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      chat: {
        user: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
        appCommandPayload: {
          appCommandMetadata: {
            appCommandId: 77,
            appCommandType: 'MESSAGE_ACTION',
          },
          space: {
            name: 'spaces/room1',
            type: 'ROOM',
          },
          message: {
            name: 'spaces/room1/messages/msg-8',
            text: 'Selected message text',
            sender: { name: 'users/u1', displayName: 'Alice', type: 'HUMAN' },
            thread: {
              name: 'spaces/room1/threads/t1',
            },
          },
        },
      },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 77,
          commandName: '/googlechat-message-action-77',
          type: 'MESSAGE_ACTION',
        },
        text: '/googlechat-message-action-77 Selected message text',
      }),
    })
  })

  it('ignores bot messages to prevent recursion', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        text: 'I am a bot',
        sender: { name: 'bots/mybot', displayName: 'MyBot', type: 'BOT' },
        thread: {},
      },
      space: { name: 'spaces/abc', type: 'ROOM' },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('ignores empty message text', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        text: '   ',
        argumentText: '',
        sender: { name: 'users/u1', type: 'HUMAN' },
        thread: {},
      },
      space: { name: 'spaces/abc', type: 'DM' },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('prefers argumentText over text for mentions', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'MESSAGE',
      message: {
        text: '@MyBot do something useful',
        argumentText: 'do something useful',
        sender: { name: 'users/u1', type: 'HUMAN' },
        thread: { name: 'spaces/abc/threads/t1' },
      },
      space: { name: 'spaces/abc', type: 'ROOM' },
    })

    await handler(req)

    expect(sendEvent).toHaveBeenCalledWith('gc-int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        text: 'do something useful',
      }),
    })
  })

  it('handles ADDED_TO_SPACE and returns welcome message', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'ADDED_TO_SPACE',
      space: { name: 'spaces/abc', displayName: 'My Space', type: 'ROOM' },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()

    const data = await res.json()

    expect(data).toHaveProperty('text')
    expect(data.text).toContain("I'm your AI assistant")

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.googlechat.addedToSpace',
      })
    )
  })

  it('handles REMOVED_FROM_SPACE and returns ok', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({
      type: 'REMOVED_FROM_SPACE',
      space: { name: 'spaces/abc', displayName: 'My Space', type: 'ROOM' },
    })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.googlechat.removed_from_space',
      })
    )
  })

  it('returns 200 for unknown event types', async () => {
    prisma.googlechatIntegration.findUnique.mockResolvedValue(integrationBase)

    const req = makeRequest({ type: 'CARD_CLICKED' })

    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
