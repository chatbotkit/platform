/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
      ability: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/ability.instruction', () => ({
  getRealInstruction: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    valid: jest.fn().mockReturnThis(),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/schemas/abilityName', () => ({}))
jest.mock('@/schemas/abilityDescription', () => ({}))
jest.mock('@/schemas/abilityInstruction', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/secretId', () => jest.fn(() => ({})))
jest.mock('@/schemas/fileId', () => jest.fn(() => ({})))
jest.mock('@/schemas/botId', () => jest.fn(() => ({})))
jest.mock('@/schemas/spaceId', () => jest.fn(() => ({})))
jest.mock('@/schemas/meta', () => ({}))

const { getRealInstruction } = require('@/lib/ability.instruction')

describe('POST /api/v1/skillset/[skillsetId]/ability/create', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getRealInstruction.mockResolvedValue('compiled-instruction')
    prisma.ability.create.mockResolvedValue({ id: 'ab-new' })
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, { name: 'Ability' })

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.create).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
    })

    const result = await handler(req, session, { name: 'Ability' })

    expect(result).toEqual({ status: 401 })
    expect(prisma.ability.create).not.toHaveBeenCalled()
  })

  it('creates ability and returns its id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })

    const result = await handler(req, session, {
      name: 'My Ability',
      description: 'Does things',
      instruction: 'some instruction',
    })

    expect(prisma.ability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My Ability',
          description: 'Does things',
          skillsetId: 'ss-1',
        }),
        select: { id: true },
      })
    )
    expect(result).toEqual({ status: 200, body: { id: 'ab-new' } })
  })

  it('stores getRealInstruction result in meta._instruction', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })
    getRealInstruction.mockResolvedValue('processed-instruction-content')

    await handler(req, session, {
      name: 'Ability',
      instruction: 'raw instruction',
    })

    const call = prisma.ability.create.mock.calls[0][0]

    expect(call.data.meta._instruction).toBe('processed-instruction-content')
  })

  it('calls getRealInstruction with the session user and instruction', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })

    await handler(req, session, { name: 'Ability', instruction: 'my instr' })

    expect(getRealInstruction).toHaveBeenCalledWith(session.user, 'my instr')
  })

  it('resolves blueprintId from an object with id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })

    await handler(req, session, {
      name: 'Ability',
      blueprintId: { id: 'bp-1' },
    })

    expect(prisma.ability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-1' }),
      })
    )
  })

  it('passes plain string blueprintId directly', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })

    await handler(req, session, { name: 'Ability', blueprintId: 'bp-string' })

    expect(prisma.ability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-string' }),
      })
    )
  })

  it('merges extra meta with the compiled instruction', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
    })
    getRealInstruction.mockResolvedValue('compiled')

    await handler(req, session, {
      name: 'Ability',
      meta: { customKey: 'customValue' },
    })

    const call = prisma.ability.create.mock.calls[0][0]

    expect(call.data.meta.customKey).toBe('customValue')
    expect(call.data.meta._instruction).toBe('compiled')
  })
})
