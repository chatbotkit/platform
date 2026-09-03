/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './avatar'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn(
    (path) => `https://chatbotkit.test${path}`
  ),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn((url) => `https://chatbotkit.test/s/short-avatar`),
}))

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    const fn = () => handlers

    fn.handlers = handlers

    return fn
  }),
}))

jest.mock(
  '@/pages/api/v1/integration/avatar/[avatarIntegrationId]/session/create',
  () => ({
    createAvatarIntegrationRealtimeSession: jest.fn(),
  })
)

import { createAvatarIntegrationRealtimeSession } from '@/pages/api/v1/integration/avatar/[avatarIntegrationId]/session/create'
import { getTempShortURL } from '@/lib/short'

describe('auxiliary/skillset/ability/chatbotkit/integration/avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  it('exports a multi-handler with getAvatarUrl', () => {
    expect(handler).toBeDefined()
    expect(handler.handlers).toBeDefined()
    expect(handler.handlers.getAvatarUrl).toBeDefined()
    expect(handler.handlers.getAvatarUrl.schema).toBeDefined()
    expect(handler.handlers.getAvatarUrl.fn).toBeDefined()
  })

  it('returns the avatar frame url', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar123',
      userId: 'user123',
    })

    createAvatarIntegrationRealtimeSession.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: 'signed-avatar-session',
        })
      )
    )

    const result = await handler.handlers.getAvatarUrl.fn(
      {
        user: {
          id: 'user123',
        },
      },
      {
        avatarIntegrationId: 'avatar123',
      },
      new Headers()
    )

    expect(prisma.avatarIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      {
        id: 'user123',
      },
      'avatar123',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    expect(createAvatarIntegrationRealtimeSession).toHaveBeenCalledWith({
      avatarIntegrationId: 'avatar123',
      req: expect.any(Request),
    })

    expect(getTempShortURL).toHaveBeenCalledWith(
      'https://chatbotkit.test/integrations/avatar/avatar123/frame?session=signed-avatar-session',
      60 * 60
    )

    expect(result).toEqual({
      url: 'https://chatbotkit.test/s/short-avatar',
    })
  })

  it('throws when the session cannot be minted', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar123',
      userId: 'user123',
    })

    createAvatarIntegrationRealtimeSession.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Broken session',
        }),
        {
          status: 409,
        }
      )
    )

    await expect(
      handler.handlers.getAvatarUrl.fn(
        {
          user: {
            id: 'user123',
          },
        },
        {
          avatarIntegrationId: 'avatar123',
        },
        new Headers()
      )
    ).rejects.toThrow('Broken session')
  })

  it('throws when the integration is not found', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      handler.handlers.getAvatarUrl.fn(
        {
          user: {
            id: 'user123',
          },
        },
        {
          avatarIntegrationId: 'missing',
        },
        new Headers()
      )
    ).rejects.toThrow('Avatar integration not found')
  })

  it('throws when the user does not own the integration', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar123',
      userId: 'other-user',
    })

    await expect(
      handler.handlers.getAvatarUrl.fn(
        {
          user: {
            id: 'user123',
          },
        },
        {
          avatarIntegrationId: 'avatar123',
        },
        new Headers()
      )
    ).rejects.toThrow('Not authorized to use this Avatar integration')
  })
})
