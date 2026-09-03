import { renderHook } from '@testing-library/react'

import prisma from '@/prisma/client'

import { canUseAnamIntegration } from '@/lib/anam.access'
import { validateAnamSession } from '@/lib/anam.session'
import fetch from '@/lib/fetch'
import { getSoftSession } from '@/lib/session.get'

import { getServerSideProps, useAnamRealtimeSession } from './frame'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    anamIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/anam.session', () => ({
  validateAnamSession: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/anam.access', () => ({
  canUseAnamIntegration: jest.fn(),
}))

describe('integrations/anam frame getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSoftSession.mockResolvedValue(null)
    canUseAnamIntegration.mockResolvedValue(false)
    validateAnamSession.mockResolvedValue(null)
  })

  it('returns a 404 redirect when the integration does not exist', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(null)

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('returns a 404 redirect when the integration is missing required setup', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: null,
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a public integration without a session token', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'anam-1',
        },
        session: null,
      },
    })

    expect(validateAnamSession).not.toHaveBeenCalled()
  })

  it('ignores an unverified session token for a public integration', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    validateAnamSession.mockResolvedValue(null)

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'anam-1',
        },
        session: null,
      },
    })

    expect(validateAnamSession).not.toHaveBeenCalled()
  })

  it('returns a 404 redirect for a non-public integration without a session token', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      userId: 'user-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a non-public integration when the authenticated user can use it directly', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      userId: 'user-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    getSoftSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })

    canUseAnamIntegration.mockResolvedValue(true)

    await expect(
      getServerSideProps({
        req: {},
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'anam-1',
        },
        session: null,
      },
    })
  })

  it('returns props for an authenticated user even when the query session targets another integration', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      userId: 'user-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    getSoftSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })

    canUseAnamIntegration.mockResolvedValue(true)

    await expect(
      getServerSideProps({
        req: {},
        query: {
          anamIntegrationId: 'anam-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'anam-1',
        },
        session: null,
      },
    })

    expect(validateAnamSession).not.toHaveBeenCalled()
  })

  it('returns a 404 redirect when the integration is missing a bot', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: null,
      visibility: 'public',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('returns a 404 redirect when the verified session token targets another integration', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'protected',
    })

    validateAnamSession.mockResolvedValue({
      anamIntegrationId: 'anam-2',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a non-public integration with a verified session token', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'protected',
    })

    validateAnamSession.mockResolvedValue({
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(
      getServerSideProps({
        query: {
          anamIntegrationId: 'anam-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'anam-1',
        },
        session: {
          anamIntegrationId: 'anam-1',
          conversationId: 'conversation-1',
          token: 'conversation-token',
          anamSessionToken: 'anam-session-token',
        },
      },
    })
  })
})

describe('useAnamRealtimeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the passed session data without calling session/create', async () => {
    const session = {
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    }

    const { result } = renderHook(() =>
      useAnamRealtimeSession({
        integrationId: 'anam-1',
        session,
      })
    )

    await expect(result.current.getSessionData()).resolves.toEqual(session)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls session/create and returns the fetched session data when no session is passed', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'anam-1',
        conversationId: 'conversation-1',
        token: 'conversation-token',
        anamSessionToken: 'anam-session-token',
      }),
    })

    const { result } = renderHook(() =>
      useAnamRealtimeSession({
        integrationId: 'anam-1',
        session: null,
      })
    )

    await expect(result.current.getSessionData()).resolves.toEqual({
      id: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/anam/anam-1/session/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      }
    )
  })

  it('reuses the cached promise for repeated calls', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'anam-1',
        conversationId: 'conversation-1',
        token: 'conversation-token',
        anamSessionToken: 'anam-session-token',
      }),
    })

    const { result } = renderHook(() =>
      useAnamRealtimeSession({
        integrationId: 'anam-1',
        session: null,
      })
    )

    await expect(result.current.getSessionData()).resolves.toEqual({
      id: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(result.current.getSessionData()).resolves.toEqual({
      id: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('clears a failed session/create promise so a later call can retry', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          message: 'temporary failure',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'anam-1',
          conversationId: 'conversation-1',
          token: 'conversation-token',
          anamSessionToken: 'anam-session-token',
        }),
      })

    const { result } = renderHook(() =>
      useAnamRealtimeSession({
        integrationId: 'anam-1',
        session: null,
      })
    )

    await expect(result.current.getSessionData()).rejects.toThrow(
      'temporary failure'
    )

    await expect(result.current.getSessionData()).resolves.toEqual({
      id: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
