/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './create'

const mockAvatarIntegrationCreate = jest.fn()

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      avatarIntegration: {
        create: (...args) => mockAvatarIntegrationCreate(...args),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
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

describe('POST /api/v1/integration/avatar/create', () => {
  const session = { user: { id: 'user-1' } }

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

  it('creates avatar integration and returns id', async () => {
    mockAvatarIntegrationCreate.mockResolvedValue({ id: 'avatar_1' })

    const res = await handler({}, session, {
      name: 'Avatar Bot',
      description: 'Avatar integration',
      blueprintId: { id: 'bp_1' },
      botId: { id: 'bot_1' },
      visibility: 'private',
      meta: { env: 'test' },
    })

    expect(mockAvatarIntegrationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Avatar Bot',
        description: 'Avatar integration',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        visibility: 'private',
        meta: { env: 'test' },
      },
      select: { id: true },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'avatar_1' })
  })

  it('supports plain blueprintId and botId values', async () => {
    mockAvatarIntegrationCreate.mockResolvedValue({ id: 'avatar_2' })

    await handler({}, session, {
      name: 'Avatar Bot',
      blueprintId: 'bp_plain',
      botId: 'bot_plain',
    })

    expect(mockAvatarIntegrationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp_plain',
          botId: 'bot_plain',
        }),
      })
    )
  })

  it('propagates prisma errors', async () => {
    mockAvatarIntegrationCreate.mockRejectedValue(new Error('db failed'))

    await expect(handler({}, session, { name: 'Avatar Bot' })).rejects.toThrow(
      'db failed'
    )
  })
})
