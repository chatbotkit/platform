/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      ability: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
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
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((incoming, existing) => ({
    ...(existing || {}),
    ...(incoming || {}),
    normalized: true,
  })),
}))

jest.mock('@/lib/ability.instruction', () => ({
  getRealInstruction: jest.fn(async (_user, instruction) =>
    instruction ? `resolved:${instruction}` : ''
  ),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/schemas/abilityName', () => ({
  __esModule: true,
  default: require('@/lib/joi.schema').default.string().allow('').optional(),
}))

jest.mock('@/schemas/abilityDescription', () => ({
  __esModule: true,
  default: require('@/lib/joi.schema').default.string().allow('').optional(),
}))

jest.mock('@/schemas/abilityInstruction', () => ({
  __esModule: true,
  default: require('@/lib/joi.schema').default.string().allow('').optional(),
}))

jest.mock('@/schemas/blueprintId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/skillsetId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/secretId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/fileId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/botId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/spaceId', () => ({
  __esModule: true,
  default: () =>
    require('@/lib/joi.schema').default.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/meta', () => ({
  __esModule: true,
  default: require('@/lib/joi.schema').default.object().optional(),
}))

const { getMeta } = require('@/lib/meta')
const { getRealInstruction } = require('@/lib/ability.instruction')
const prisma = require('@/prisma/client').default

describe('/api/v1/ability/[abilityId]/update', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { abilityId: 'ability_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when ability is missing', async () => {
    prisma.ability.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.update).not.toHaveBeenCalled()
  })

  it('returns 401 when ability belongs to another user', async () => {
    prisma.ability.findUniqueByIdentifier.mockResolvedValue({
      id: 'ability_1',
      userId: 'another_user',
      meta: {},
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.ability.update).not.toHaveBeenCalled()
  })

  it('updates ability with resolved links and meta', async () => {
    prisma.ability.findUniqueByIdentifier.mockResolvedValue({
      id: 'ability_1',
      userId: 'user_1',
      meta: { existing: true },
    })
    prisma.ability.update.mockResolvedValue({ id: 'ability_1' })

    const result = await handler(req, session, {
      name: 'Updated name',
      description: 'Updated description',
      blueprintId: { id: 'blueprint_1' },
      skillsetId: 'skillset_1',
      linkedSecretId: { id: 'secret_1' },
      linkedFileId: 'file_1',
      linkedBotId: { id: 'bot_1' },
      linkedSpaceId: 'space_1',
      instruction: 'do-work',
      meta: { incoming: true },
    })

    expect(getMeta).toHaveBeenCalledWith({ incoming: true }, { existing: true })
    expect(getRealInstruction).toHaveBeenCalledWith(session.user, 'do-work')
    expect(prisma.ability.update).toHaveBeenCalledWith({
      where: { id: 'ability_1' },
      data: {
        name: 'Updated name',
        description: 'Updated description',
        blueprintId: 'blueprint_1',
        skillsetId: 'skillset_1',
        linkedSecretId: 'secret_1',
        linkedFileId: 'file_1',
        linkedBotId: 'bot_1',
        linkedSpaceId: 'space_1',
        instruction: 'do-work',
        meta: {
          existing: true,
          incoming: true,
          normalized: true,
          _instruction: 'resolved:do-work',
        },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'ability_1' } })
  })

  it('propagates update errors', async () => {
    prisma.ability.findUniqueByIdentifier.mockResolvedValue({
      id: 'ability_1',
      userId: 'user_1',
      meta: {},
    })
    prisma.ability.update.mockRejectedValue(new Error('update failed'))

    await expect(handler(req, session, {})).rejects.toThrow('update failed')
  })

  it('exposes expected body schema fields', () => {
    const schema = bodySchema.describe()

    expect(schema.keys.name).toBeDefined()
    expect(schema.keys.description).toBeDefined()
    expect(schema.keys.instruction).toBeDefined()
    expect(schema.keys.meta).toBeDefined()
  })
})
