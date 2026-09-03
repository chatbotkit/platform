/**
 * @jest-environment node
 */
import handler, { doSetup } from './setup'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      twilioIntegration: {
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

jest.mock('@/lib/debug', () => jest.fn())

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
  }
})

const prisma = jest.requireMock('@/prisma/client').default
const debug = jest.requireMock('@/lib/debug')
const { captureError } = jest.requireMock('@/lib/error')

beforeEach(() => {
  jest.clearAllMocks()
  debug.mockReset()
})

describe('POST /api/v1/integration/twilio/[twilioIntegrationId]/setup', () => {
  const session = { user: { id: 'user-1' } }

  it('returns 404 when integration does not exist', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(response.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 't-1',
      userId: 'other-user',
    })

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(response.status).toBe(403)
  })

  it('runs setup and returns integration id for owner', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 't-1',
      userId: 'user-1',
    })

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 't-1' })
    expect(debug).toHaveBeenCalledWith('do setup', {
      twilioIntegration: {
        id: 't-1',
        userId: 'user-1',
      },
    })
  })

  it('captures setup errors and responds with error payload', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 't-1',
      userId: 'user-1',
    })
    debug.mockImplementation(() => {
      throw new Error('setup failed')
    })

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(captureError).toHaveBeenCalledWith(expect.any(Error))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      code: 'GENERIC_ERROR',
      message: 'setup failed',
    })
  })
})

describe('doSetup', () => {
  it('logs setup intent and resolves', async () => {
    const integration = { id: 't-2', userId: 'user-2' }

    await expect(doSetup(integration)).resolves.toBeUndefined()
    expect(debug).toHaveBeenCalledWith('do setup', {
      twilioIntegration: integration,
    })
  })
})
