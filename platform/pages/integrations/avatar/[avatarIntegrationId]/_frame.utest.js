import { renderHook } from '@testing-library/react'

import prisma from '@/prisma/client'

import { canUseAvatarIntegration } from '@/lib/avatar.access'
import { validateAvatarSession } from '@/lib/avatar.session'
import fetch from '@/lib/fetch'
import { getSoftSession } from '@/lib/session.get'

import { getServerSideProps, useAvatarRealtimeSession } from './frame'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    avatarIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/avatar.session', () => ({
  validateAvatarSession: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/avatar.access', () => ({
  canUseAvatarIntegration: jest.fn(),
}))

describe('integrations/avatar frame getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSoftSession.mockResolvedValue(null)
    canUseAvatarIntegration.mockResolvedValue(false)
    validateAvatarSession.mockResolvedValue(null)
  })

  it('returns a 404 redirect when the integration does not exist', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue(null)

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('returns a 404 redirect when the integration is missing a bot', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      botId: null,
      visibility: 'public',
    })

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a public integration without a session token', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'avatar-1',
        },
        session: null,
      },
    })

    expect(validateAvatarSession).not.toHaveBeenCalled()
  })

  it('ignores an unverified session token for a public integration', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    validateAvatarSession.mockResolvedValue(null)

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'avatar-1',
        },
        session: null,
      },
    })

    expect(validateAvatarSession).not.toHaveBeenCalled()
  })

  it('returns a 404 redirect for a non-public integration without a session token', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a non-public integration when the authenticated user can use it directly', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    getSoftSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })

    canUseAvatarIntegration.mockResolvedValue(true)

    await expect(
      getServerSideProps({
        req: {},
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'avatar-1',
        },
        session: null,
      },
    })
  })

  it('returns props for an authenticated user even when the query session targets another integration', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    getSoftSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })

    canUseAvatarIntegration.mockResolvedValue(true)

    await expect(
      getServerSideProps({
        req: {},
        query: {
          avatarIntegrationId: 'avatar-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'avatar-1',
        },
        session: null,
      },
    })

    expect(validateAvatarSession).not.toHaveBeenCalled()
  })

  it('returns a 404 redirect when the verified session token targets another integration', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      botId: 'bot-1',
      visibility: 'protected',
    })

    validateAvatarSession.mockResolvedValue({
      avatarIntegrationId: 'avatar-2',
      websocket: 'wss://example.test/socket',
    })

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('returns props for a non-public integration with a verified session token', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      botId: 'bot-1',
      visibility: 'protected',
    })

    validateAvatarSession.mockResolvedValue({
      avatarIntegrationId: 'avatar-1',
      websocket: 'wss://example.test/socket',
    })

    await expect(
      getServerSideProps({
        query: {
          avatarIntegrationId: 'avatar-1',
          session: 'jwt-token',
        },
      })
    ).resolves.toEqual({
      props: {
        integration: {
          id: 'avatar-1',
        },
        session: {
          avatarIntegrationId: 'avatar-1',
          websocket: 'wss://example.test/socket',
        },
      },
    })
  })
})

describe('useAvatarRealtimeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the passed session websocket without calling session/create', async () => {
    const session = {
      avatarIntegrationId: 'avatar-1',
      websocket: 'wss://example.test/signed',
    }

    const { result } = renderHook(() =>
      useAvatarRealtimeSession({
        integrationId: 'avatar-1',
        session,
      })
    )

    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/signed'
    )

    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls session/create and returns the fetched websocket when no session is passed', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        websocket: 'wss://example.test/fetched',
      }),
    })

    const { result } = renderHook(() =>
      useAvatarRealtimeSession({
        integrationId: 'avatar-1',
        session: null,
      })
    )

    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/fetched'
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/avatar/avatar-1/session/create',
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
        websocket: 'wss://example.test/fetched',
      }),
    })

    const { result } = renderHook(() =>
      useAvatarRealtimeSession({
        integrationId: 'avatar-1',
        session: null,
      })
    )

    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/fetched'
    )
    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/fetched'
    )

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
          websocket: 'wss://example.test/retried',
        }),
      })

    const { result } = renderHook(() =>
      useAvatarRealtimeSession({
        integrationId: 'avatar-1',
        session: null,
      })
    )

    await expect(result.current.getWebsocket()).rejects.toThrow(
      'temporary failure'
    )

    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/retried'
    )

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
