/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      notionIntegration: {
        create: jest.fn(),
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

describe('/api/v1/integration/notion/create', () => {
  const mockSession = { user: { id: 'user-123' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a notion integration and returns id', async () => {
    prisma.notionIntegration.create.mockResolvedValue({ id: 'notion-1' })

    const response = await handler({}, mockSession, {
      name: 'Notion Sync',
      description: 'Sync internal docs',
      blueprintId: { id: 'bp-1' },
      datasetId: { id: 'ds-1' },
      token: 'secret_token',
      syncSchedule: '0 * * * *',
      expiresIn: 60000,
      meta: { project: 'docs' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'notion-1' })
    expect(prisma.notionIntegration.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        name: 'Notion Sync',
        description: 'Sync internal docs',
        blueprintId: 'bp-1',
        datasetId: 'ds-1',
        token: 'secret_token',
        syncSchedule: '0 * * * *',
        expiresIn: 60000,
        meta: { project: 'docs' },
      },
      select: { id: true },
    })
  })

  it('strips masked token value', async () => {
    prisma.notionIntegration.create.mockResolvedValue({ id: 'notion-2' })

    await handler({}, mockSession, {
      token: '********',
      datasetId: 'ds-raw',
      blueprintId: 'bp-raw',
    })

    expect(prisma.notionIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: undefined,
          datasetId: 'ds-raw',
          blueprintId: 'bp-raw',
        }),
      })
    )
  })

  it('propagates prisma errors', async () => {
    prisma.notionIntegration.create.mockRejectedValue(new Error('db failed'))

    await expect(handler({}, mockSession, {})).rejects.toThrow('db failed')
  })
})
