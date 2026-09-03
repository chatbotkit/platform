/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './create'

const mockAnamIntegrationCreate = jest.fn()

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      anamIntegration: {
        create: (...args) => mockAnamIntegrationCreate(...args),
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

describe('POST /api/v1/integration/anam/create', () => {
  const session = { user: { id: 'user-1' } }

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

  it('creates anam integration and returns id', async () => {
    mockAnamIntegrationCreate.mockResolvedValue({ id: 'anam_1' })

    const res = await handler({}, session, {
      name: 'Anam Bot',
      description: 'Anam integration',
      blueprintId: { id: 'bp_1' },
      botId: { id: 'bot_1' },
      apiKey: 'anam-key',
      personaId: 'persona_1',
      visibility: 'private',
      meta: { env: 'test' },
    })

    expect(mockAnamIntegrationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Anam Bot',
        description: 'Anam integration',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        apiKey: 'anam-key',
        personaId: 'persona_1',
        visibility: 'private',
        meta: { env: 'test' },
      },
      select: { id: true },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'anam_1' })
  })

  it('supports plain blueprint and bot identifiers', async () => {
    mockAnamIntegrationCreate.mockResolvedValue({ id: 'anam_2' })

    await handler({}, session, {
      name: 'Anam Bot',
      blueprintId: 'bp_plain',
      botId: 'bot_plain',
    })

    expect(mockAnamIntegrationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp_plain',
          botId: 'bot_plain',
        }),
      })
    )
  })

  it('propagates prisma errors', async () => {
    mockAnamIntegrationCreate.mockRejectedValue(new Error('db failed'))

    await expect(handler({}, session, { name: 'Anam Bot' })).rejects.toThrow(
      'db failed'
    )
  })
})
