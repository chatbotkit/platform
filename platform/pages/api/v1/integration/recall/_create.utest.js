/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      create: jest.fn(),
    },
  },
}))

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

jest.mock('@/lib/recall.bot', () => ({
  RECALL_REGIONS: ['us-east-1', 'eu-central-1'],
  getRecallRegionStorageValue: jest.fn((value) =>
    value ? `normalized-${value}` : null
  ),
}))

const { getRecallRegionStorageValue } = require('@/lib/recall.bot')

describe('POST /api/v1/integration/recall/create', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts valid create body and rejects invalid region', () => {
    const { error: validError } = bodySchema.validate({
      name: 'Recall',
      region: 'us-east-1',
    })
    const { error: invalidError } = bodySchema.validate({
      name: 'Recall',
      region: 'ap-south-1',
    })

    expect(validError).toBeUndefined()
    expect(invalidError).toBeDefined()
  })

  it('creates recall integration and returns id', async () => {
    prisma.recallIntegration.create.mockResolvedValue({ id: 'rec_1' })

    const res = await handler({}, session, {
      name: 'Recall Bot',
      description: 'Meeting assistant',
      blueprintId: { id: 'bp_1' },
      botId: { id: 'bot_1' },
      apiKey: 'recall-key',
      region: 'eu-central-1',
      meta: { env: 'test' },
    })

    expect(getRecallRegionStorageValue).toHaveBeenCalledWith('eu-central-1')
    expect(prisma.recallIntegration.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Recall Bot',
        description: 'Meeting assistant',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        apiKey: 'recall-key',
        region: 'normalized-eu-central-1',
        meta: { env: 'test' },
      },
      select: { id: true },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'rec_1' })
  })

  it('supports plain identifiers and empty region values', async () => {
    prisma.recallIntegration.create.mockResolvedValue({ id: 'rec_2' })

    await handler({}, session, {
      name: 'Recall Bot',
      blueprintId: 'bp_plain',
      botId: 'bot_plain',
      region: '',
    })

    expect(getRecallRegionStorageValue).toHaveBeenCalledWith('')
    expect(prisma.recallIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp_plain',
          botId: 'bot_plain',
          region: null,
        }),
      })
    )
  })

  it('propagates prisma errors', async () => {
    prisma.recallIntegration.create.mockRejectedValue(new Error('db failed'))

    await expect(handler({}, session, { name: 'Recall Bot' })).rejects.toThrow(
      'db failed'
    )
  })
})
