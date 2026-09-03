/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
      ability: {
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/ability.instruction', () => ({
  getRealInstruction: jest.fn(),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, existingMeta) => ({
    ...(existingMeta || {}),
    ...(newMeta || {}),
  })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
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
const { getMeta } = require('@/lib/meta')

describe('POST /api/v1/skillset/[skillsetId]/ability/[abilityId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1', abilityId: 'ab-1' } }

  const existingAbility = {
    id: 'ab-1',
    instruction: 'old instruction',
    meta: { existingKey: 'existingValue' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getRealInstruction.mockResolvedValue('compiled-new-instruction')
    prisma.ability.update.mockResolvedValue({ id: 'ab-1' })
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, { name: 'Updated' })

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.update).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
      abilities: [existingAbility],
    })

    const result = await handler(req, session, { name: 'Updated' })

    expect(result).toEqual({ status: 401 })
    expect(prisma.ability.update).not.toHaveBeenCalled()
  })

  it('returns 404 when ability is not found in the skillset', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [],
    })

    const result = await handler(req, session, { name: 'Updated' })

    expect(result).toEqual({ status: 404 })
    expect(prisma.ability.update).not.toHaveBeenCalled()
  })

  it('updates ability and returns its id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [existingAbility],
    })

    const result = await handler(req, session, {
      name: 'Updated Ability',
      description: 'New description',
      instruction: 'new instruction',
    })

    expect(prisma.ability.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ab-1' } })
    )
    expect(result).toEqual({ status: 200, body: { id: 'ab-1' } })
  })

  it('stores getRealInstruction result in meta._instruction', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [existingAbility],
    })
    getRealInstruction.mockResolvedValue('compiled-result')

    await handler(req, session, { instruction: 'new instruction' })

    const call = prisma.ability.update.mock.calls[0][0]

    expect(call.data.meta._instruction).toBe('compiled-result')
  })

  it('calls getRealInstruction with the session user and new instruction', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [existingAbility],
    })

    await handler(req, session, { instruction: 'my updated instr' })

    expect(getRealInstruction).toHaveBeenCalledWith(
      session.user,
      'my updated instr'
    )
  })

  it('merges existing meta with new meta via getMeta', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [existingAbility],
    })
    getMeta.mockReturnValue({
      existingKey: 'existingValue',
      newKey: 'newValue',
    })

    await handler(req, session, { meta: { newKey: 'newValue' } })

    expect(getMeta).toHaveBeenCalledWith(
      { newKey: 'newValue' },
      existingAbility.meta
    )

    const call = prisma.ability.update.mock.calls[0][0]

    expect(call.data.meta.existingKey).toBe('existingValue')
    expect(call.data.meta.newKey).toBe('newValue')
  })

  it('resolves blueprintId from an object with id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      abilities: [existingAbility],
    })

    await handler(req, session, { blueprintId: { id: 'bp-1' } })

    expect(prisma.ability.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-1' }),
      })
    )
  })
})
