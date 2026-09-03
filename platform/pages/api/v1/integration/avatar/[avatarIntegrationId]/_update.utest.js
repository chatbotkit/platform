/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

const mockAvatarIntegrationFindUniqueByIdentifier = jest.fn()
const mockAvatarIntegrationUpdate = jest.fn()

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      avatarIntegration: {
        findUniqueByIdentifier: (...args) =>
          mockAvatarIntegrationFindUniqueByIdentifier(...args),
        update: (...args) => mockAvatarIntegrationUpdate(...args),
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

describe('POST /api/v1/integration/avatar/[avatarIntegrationId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { avatarIntegrationId: 'avatar_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts valid body and rejects invalid visibility', () => {
    const { error: validError } = bodySchema.validate({
      name: 'Avatar',
      visibility: 'private',
    })
    const { error: invalidError } = bodySchema.validate({
      name: 'Avatar',
      visibility: 'invalid-visibility',
    })

    expect(validError).toBeUndefined()
    expect(invalidError).toBeDefined()
  })

  it('returns 404 when integration is not found', async () => {
    mockAvatarIntegrationFindUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session, { name: 'Updated' })

    expect(res.status).toBe(404)
    expect(mockAvatarIntegrationUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 for non-owner integration', async () => {
    mockAvatarIntegrationFindUniqueByIdentifier.mockResolvedValue({
      id: 'avatar_1',
      userId: 'other-user',
      meta: {},
    })

    const res = await handler(req, session, { name: 'Updated' })

    expect(res.status).toBe(403)
    expect(mockAvatarIntegrationUpdate).not.toHaveBeenCalled()
  })

  it('updates integration for owner and merges meta', async () => {
    mockAvatarIntegrationFindUniqueByIdentifier.mockResolvedValue({
      id: 'avatar_1',
      userId: 'user-1',
      meta: { existing: true },
    })
    mockAvatarIntegrationUpdate.mockResolvedValue({})

    const res = await handler(req, session, {
      name: 'Updated Avatar',
      description: 'Updated description',
      blueprintId: { id: 'bp_2' },
      botId: 'bot_2',
      visibility: 'public',
      meta: { added: 'yes' },
    })

    expect(getMeta).toHaveBeenCalledWith({ added: 'yes' }, { existing: true })
    expect(mockAvatarIntegrationUpdate).toHaveBeenCalledWith({
      where: { id: 'avatar_1' },
      data: {
        name: 'Updated Avatar',
        description: 'Updated description',
        blueprintId: 'bp_2',
        botId: 'bot_2',
        visibility: 'public',
        meta: { existing: true, added: 'yes' },
      },
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'avatar_1' })
  })

  it('propagates prisma errors', async () => {
    mockAvatarIntegrationFindUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session, { name: 'Updated' })).rejects.toThrow(
      'db failed'
    )
  })
})
