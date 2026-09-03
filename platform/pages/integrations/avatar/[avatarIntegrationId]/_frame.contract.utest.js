import prisma from '@/prisma/client'

import { canUseAvatarIntegration } from '@/lib/avatar.access'
// @note we deliberately do NOT mock @/lib/avatar.session here - this suite uses
// the real sign + validate implementations so it proves the end-to-end
// contract between what the create endpoint mints and what the frame consumes
import { signAvatarSession } from '@/lib/avatar.session'
import fetch from '@/lib/fetch'
import { getSoftSession } from '@/lib/session.get'

import { getServerSideProps, useAvatarRealtimeSession } from './frame'

import { renderHook } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    avatarIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/avatar.access', () => ({
  canUseAvatarIntegration: jest.fn(),
}))

// @note this mirrors exactly the object that the session/create endpoint signs
// (see pages/api/v1/integration/avatar/[avatarIntegrationId]/session/create.js)
function makeFrameSession(overrides = {}) {
  return {
    avatarIntegrationId: 'avatar-1',
    websocket: 'wss://example.test/socket',
    ...overrides,
  }
}

describe('integrations/avatar minted session contract', () => {
  beforeAll(() => {
    process.env.JWT_TOKEN_SECRET_KEY =
      process.env.JWT_TOKEN_SECRET_KEY || 'test-secret-test-secret-test-secret-0000'
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // a private integration that can only be unlocked by a minted session - no
    // soft session and no direct access, so the query token is the only way in
    getSoftSession.mockResolvedValue(null)
    canUseAvatarIntegration.mockResolvedValue(false)

    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })
  })

  it('unlocks a private frame with a freshly minted session and preserves the client fields', async () => {
    const frameSession = makeFrameSession()

    // real sign - exactly as the create endpoint does
    const session = await signAvatarSession(frameSession)

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {
        avatarIntegrationId: 'avatar-1',
        session,
      },
    })

    expect(result.props.integration).toEqual({ id: 'avatar-1' })

    // the binding field and every field the client reads must survive the
    // sign -> validate round trip
    expect(result.props.session).toMatchObject(frameSession)
  })

  it('feeds the unlocked session straight into the client hook without calling session/create', async () => {
    const session = await signAvatarSession(makeFrameSession())

    const { props } = await getServerSideProps({
      req: {},
      res: {},
      query: {
        avatarIntegrationId: 'avatar-1',
        session,
      },
    })

    const { result } = renderHook(() =>
      useAvatarRealtimeSession({
        integrationId: 'avatar-1',
        session: props.session,
      })
    )

    await expect(result.current.getWebsocket()).resolves.toBe(
      'wss://example.test/socket'
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a session minted for a different integration', async () => {
    const session = await signAvatarSession(
      makeFrameSession({ avatarIntegrationId: 'avatar-2' })
    )

    await expect(
      getServerSideProps({
        req: {},
        res: {},
        query: {
          avatarIntegrationId: 'avatar-1',
          session,
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('rejects a token signed with a different secret', async () => {
    const realSecret = process.env.JWT_TOKEN_SECRET_KEY

    process.env.JWT_TOKEN_SECRET_KEY = 'attacker-secret-attacker-secret-attacker'

    const forged = await signAvatarSession(makeFrameSession())

    process.env.JWT_TOKEN_SECRET_KEY = realSecret

    await expect(
      getServerSideProps({
        req: {},
        res: {},
        query: {
          avatarIntegrationId: 'avatar-1',
          session: forged,
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })

  it('rejects a garbage session token', async () => {
    await expect(
      getServerSideProps({
        req: {},
        res: {},
        query: {
          avatarIntegrationId: 'avatar-1',
          session: 'not.a.valid.jwt',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/avatar/avatar-1/404',
        permanent: false,
      },
    })
  })
})
