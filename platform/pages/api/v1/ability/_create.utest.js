/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/ability.instruction', () => ({
  getRealInstruction: jest.fn(async () => 'resolved instruction'),
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

const { getRealInstruction } = require('@/lib/ability.instruction')

describe('/api/v1/ability/create', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('creates ability and maps linked resource ids', async () => {
    prisma.ability.create.mockResolvedValue({ id: 'ability_1' })

    const result = await handler(null, session, {
      name: 'Ability name',
      description: 'Ability description',
      blueprintId: { id: 'blueprint_1' },
      skillsetId: 'skillset_1',
      linkedSecretId: { id: 'secret_1' },
      linkedFileId: 'file_1',
      linkedBotId: { id: 'bot_1' },
      linkedSpaceId: 'space_1',
      instruction: 'Do X',
      meta: { channel: 'test' },
    })

    expect(getRealInstruction).toHaveBeenCalledWith(session.user, 'Do X')
    expect(prisma.ability.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        name: 'Ability name',
        description: 'Ability description',
        blueprintId: 'blueprint_1',
        skillsetId: 'skillset_1',
        linkedSecretId: 'secret_1',
        linkedFileId: 'file_1',
        linkedBotId: 'bot_1',
        linkedSpaceId: 'space_1',
        instruction: 'Do X',
        meta: {
          channel: 'test',
          _instruction: 'resolved instruction',
        },
      },
      select: {
        id: true,
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'ability_1' } })
  })

  it('handles missing optional links and missing meta', async () => {
    prisma.ability.create.mockResolvedValue({ id: 'ability_2' })

    await handler(null, session, {
      name: 'Simple ability',
      instruction: 'Do Y',
    })

    expect(prisma.ability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: undefined,
          skillsetId: undefined,
          linkedSecretId: undefined,
          linkedFileId: undefined,
          linkedBotId: undefined,
          linkedSpaceId: undefined,
          meta: { _instruction: 'resolved instruction' },
        }),
      })
    )
  })

  it('persists the alias on the created ability', async () => {
    prisma.ability.create.mockResolvedValue({ id: 'ability_3' })

    await handler(null, session, {
      name: 'Aliased ability',
      instruction: 'Do Z',
      alias: 'my-ability',
    })

    const callData = prisma.ability.create.mock.calls[0][0].data

    expect(callData.alias).toBe('my-ability')
  })

  it('propagates prisma errors', async () => {
    prisma.ability.create.mockRejectedValue(new Error('db failed'))

    await expect(
      handler(null, session, {
        name: 'Broken ability',
        instruction: 'Do Z',
      })
    ).rejects.toThrow('db failed')
  })
})
