/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './anam'

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
  getTempShortURL: jest.fn((url) => `https://chatbotkit.test/s/short-anam`),
}))

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    const fn = () => handlers

    fn.handlers = handlers

    return fn
  }),
}))

jest.mock(
  '@/pages/api/v1/integration/anam/[anamIntegrationId]/session/create',
  () => ({
    createAnamIntegrationSession: jest.fn(),
  })
)

import { createAnamIntegrationSession } from '@/pages/api/v1/integration/anam/[anamIntegrationId]/session/create'
import { getTempShortURL } from '@/lib/short'

describe('auxiliary/skillset/ability/chatbotkit/integration/anam/avatar', () => {
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

  it('returns the anam frame url', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam123',
      userId: 'user123',
    })

    createAnamIntegrationSession.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: 'signed-anam-session',
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
        anamIntegrationId: 'anam123',
      },
      new Headers()
    )

    expect(prisma.anamIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      {
        id: 'user123',
      },
      'anam123',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    expect(createAnamIntegrationSession).toHaveBeenCalledWith({
      anamIntegrationId: 'anam123',
      req: expect.any(Request),
    })

    expect(getTempShortURL).toHaveBeenCalledWith(
      'https://chatbotkit.test/integrations/anam/anam123/frame?session=signed-anam-session',
      60 * 60
    )

    expect(result).toEqual({
      url: 'https://chatbotkit.test/s/short-anam',
    })
  })

  it('throws when the session cannot be minted', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam123',
      userId: 'user123',
    })

    createAnamIntegrationSession.mockResolvedValue(
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
          anamIntegrationId: 'anam123',
        },
        new Headers()
      )
    ).rejects.toThrow('Broken session')
  })

  it('throws when the integration is not found', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      handler.handlers.getAvatarUrl.fn(
        {
          user: {
            id: 'user123',
          },
        },
        {
          anamIntegrationId: 'missing',
        },
        new Headers()
      )
    ).rejects.toThrow('Anam integration not found')
  })

  it('throws when the user does not own the integration', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam123',
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
          anamIntegrationId: 'anam123',
        },
        new Headers()
      )
    ).rejects.toThrow('Not authorized to use this Anam integration')
  })
})
