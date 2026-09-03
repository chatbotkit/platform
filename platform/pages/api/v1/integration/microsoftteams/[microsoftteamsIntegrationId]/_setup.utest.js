/**
 * @jest-environment node
 */
import fetch from '@/lib/fetch'

import handler, { doSetup } from './setup'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      microsoftteamsIntegration: {
        findUniqueByIdentifier: jest.fn(),
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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
  }
})

const prisma = jest.requireMock('@/prisma/client').default

describe('doSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws conflict when app id is missing', async () => {
    await expect(
      doSetup({
        botFrameworkAppId: '',
        botFrameworkAppSecret: 'secret',
      })
    ).rejects.toThrow('No botFrameworkAppId specified')
  })

  it('throws conflict when app secret is missing', async () => {
    await expect(
      doSetup({
        botFrameworkAppId: 'app-id',
        botFrameworkAppSecret: '',
      })
    ).rejects.toThrow('No botFrameworkAppSecret specified')
  })

  it('uses botframework.com tenant when tenantId is not provided', async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    })

    await doSetup({
      botFrameworkAppId: 'app-id',
      botFrameworkAppSecret: 'secret',
      tenantId: '',
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('login.microsoftonline.com/botframework.com'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws conflict when token endpoint returns a non-ok response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue('invalid credentials'),
    })

    await expect(
      doSetup({
        botFrameworkAppId: 'app-id',
        botFrameworkAppSecret: 'secret',
        tenantId: 'tenant-id',
      })
    ).rejects.toThrow('Failed to validate Bot Framework credentials')
  })
})

describe('POST /api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/setup', () => {
  const req = { query: { microsoftteamsIntegrationId: 'teams-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    })
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
      null
    )

    const response = await handler(req, session)

    expect(response.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      userId: 'other-user',
    })

    const response = await handler(req, session)

    expect(response.status).toBe(403)
  })

  it('returns 200 and id when setup succeeds for owner', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      userId: 'user-1',
      botFrameworkAppId: 'app-id',
      botFrameworkAppSecret: 'secret',
      tenantId: 'tenant-id',
    })

    const response = await handler(req, session)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 'teams-1' })
  })
})
