import prisma from '@/prisma/client'

import { canUseAnamIntegration } from '@/lib/anam.access'
// @note we deliberately do NOT mock @/lib/anam.session here - this suite uses
// the real sign + validate implementations so it proves the end-to-end
// contract between what the create endpoint mints and what the frame consumes
import { signAnamSession } from '@/lib/anam.session'
import fetch from '@/lib/fetch'
import { getSoftSession } from '@/lib/session.get'

import { getServerSideProps, useAnamRealtimeSession } from './frame'

import { renderHook } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    anamIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/anam.access', () => ({
  canUseAnamIntegration: jest.fn(),
}))

// @note this mirrors exactly the object that the session/create endpoint signs
// (see pages/api/v1/integration/anam/[anamIntegrationId]/session/create.js)
function makeFrameSession(overrides = {}) {
  return {
    anamIntegrationId: 'anam-1',
    conversationId: 'conversation-1',
    token: 'conversation-token',
    anamSessionToken: 'anam-session-token',
    ...overrides,
  }
}

describe('integrations/anam minted session contract', () => {
  beforeAll(() => {
    process.env.JWT_TOKEN_SECRET_KEY =
      process.env.JWT_TOKEN_SECRET_KEY || 'test-secret-test-secret-test-secret-0000'
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // a private integration that can only be unlocked by a minted session - no
    // soft session and no direct access, so the query token is the only way in
    getSoftSession.mockResolvedValue(null)
    canUseAnamIntegration.mockResolvedValue(false)

    prisma.anamIntegration.findUnique.mockResolvedValue({
      id: 'anam-1',
      userId: 'user-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      botId: 'bot-1',
      visibility: 'private',
    })
  })

  it('unlocks a private frame with a freshly minted session and preserves the client fields', async () => {
    const frameSession = makeFrameSession()

    // real sign - exactly as the create endpoint does
    const session = await signAnamSession(frameSession)

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {
        anamIntegrationId: 'anam-1',
        session,
      },
    })

    expect(result.props.integration).toEqual({ id: 'anam-1' })

    // the binding field and every field the client reads must survive the
    // sign -> validate round trip
    expect(result.props.session).toMatchObject(frameSession)
  })

  it('feeds the unlocked session straight into the client hook without calling session/create', async () => {
    const session = await signAnamSession(makeFrameSession())

    const { props } = await getServerSideProps({
      req: {},
      res: {},
      query: {
        anamIntegrationId: 'anam-1',
        session,
      },
    })

    const { result } = renderHook(() =>
      useAnamRealtimeSession({
        integrationId: 'anam-1',
        session: props.session,
      })
    )

    const data = await result.current.getSessionData()

    expect(data).toMatchObject({
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a session minted for a different integration', async () => {
    const session = await signAnamSession(
      makeFrameSession({ anamIntegrationId: 'anam-2' })
    )

    await expect(
      getServerSideProps({
        req: {},
        res: {},
        query: {
          anamIntegrationId: 'anam-1',
          session,
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })

  it('rejects a token signed with a different secret', async () => {
    const realSecret = process.env.JWT_TOKEN_SECRET_KEY

    process.env.JWT_TOKEN_SECRET_KEY = 'attacker-secret-attacker-secret-attacker'

    const forged = await signAnamSession(makeFrameSession())

    process.env.JWT_TOKEN_SECRET_KEY = realSecret

    await expect(
      getServerSideProps({
        req: {},
        res: {},
        query: {
          anamIntegrationId: 'anam-1',
          session: forged,
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
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
          anamIntegrationId: 'anam-1',
          session: 'not.a.valid.jwt',
        },
      })
    ).resolves.toEqual({
      redirect: {
        destination: '/integrations/anam/anam-1/404',
        permanent: false,
      },
    })
  })
})
