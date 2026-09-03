/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

const mockAnamIntegrationFindUniqueByIdentifier = jest.fn()
const mockAnamIntegrationUpdate = jest.fn()

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      anamIntegration: {
        findUniqueByIdentifier: (...args) =>
          mockAnamIntegrationFindUniqueByIdentifier(...args),
        update: (...args) => mockAnamIntegrationUpdate(...args),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/schemas/blueprintId', () => {
  const { default: schema } = jest.requireActual('@/lib/joi.handler')

  return () => schema.any().allow(null, '')
})

jest.mock('@/schemas/botId', () => {
  const { default: schema } = jest.requireActual('@/lib/joi.handler')

  return () => schema.any().allow(null, '')
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/meta', () => ({
  ...jest.requireActual('@/lib/meta'),
  getMeta: jest.fn((next = {}, prev = {}) => ({ ...prev, ...next })),
}))

const { getMeta } = require('@/lib/meta')

describe('POST /api/v1/integration/anam/[anamIntegrationId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { anamIntegrationId: 'anam_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts valid body and rejects invalid visibility', () => {
    const { error: validError } = bodySchema.validate({
      name: 'Anam',
      visibility: 'private',
    })
    const { error: invalidError } = bodySchema.validate({
      name: 'Anam',
      visibility: 'invalid-visibility',
    })

    expect(validError).toBeUndefined()
    expect(invalidError).toBeDefined()
  })

  it('returns 404 when integration is not found', async () => {
    mockAnamIntegrationFindUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session, { name: 'Updated' })

    expect(res.status).toBe(404)
    expect(mockAnamIntegrationUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 for non-owner integration', async () => {
    mockAnamIntegrationFindUniqueByIdentifier.mockResolvedValue({
      id: 'anam_1',
      userId: 'other-user',
      meta: {},
    })

    const res = await handler(req, session, { name: 'Updated' })

    expect(res.status).toBe(403)
    expect(mockAnamIntegrationUpdate).not.toHaveBeenCalled()
  })

  it('updates integration for owner and merges meta', async () => {
    mockAnamIntegrationFindUniqueByIdentifier.mockResolvedValue({
      id: 'anam_1',
      userId: 'user-1',
      meta: { existing: true },
    })
    mockAnamIntegrationUpdate.mockResolvedValue({})

    const res = await handler(req, session, {
      name: 'Updated Anam',
      description: 'Updated description',
      blueprintId: { id: 'bp_2' },
      botId: 'bot_2',
      apiKey: 'anam-updated-key',
      personaId: 'persona_2',
      visibility: 'public',
      meta: { added: 'yes' },
    })

    expect(getMeta).toHaveBeenCalledWith({ added: 'yes' }, { existing: true })
    expect(mockAnamIntegrationUpdate).toHaveBeenCalledWith({
      where: { id: 'anam_1' },
      data: {
        name: 'Updated Anam',
        description: 'Updated description',
        blueprintId: 'bp_2',
        botId: 'bot_2',
        apiKey: 'anam-updated-key',
        personaId: 'persona_2',
        visibility: 'public',
        meta: { existing: true, added: 'yes' },
      },
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'anam_1' })
  })

  it('propagates prisma errors', async () => {
    mockAnamIntegrationFindUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session, { name: 'Updated' })).rejects.toThrow(
      'db failed'
    )
  })
})
