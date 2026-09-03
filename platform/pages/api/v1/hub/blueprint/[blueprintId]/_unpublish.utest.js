/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './unpublish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      blueprint: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubBlueprintPage: {
        delete: jest.fn(),
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('/api/v1/hub/blueprint/[blueprintId]/unpublish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { blueprintId: 'bp_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and deleted hub page id for owner', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp_1',
      userId: 'user_1',
    })
    prisma.hubBlueprintPage.delete.mockResolvedValue({ id: 'hub_page_1' })

    const result = await handler(req, session, {})

    expect(prisma.blueprint.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'bp_1'
    )
    expect(prisma.hubBlueprintPage.delete).toHaveBeenCalledWith({
      where: { blueprintId: 'bp_1' },
      select: { id: true },
    })
    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_page_1', blueprintId: 'bp_1' },
    })
  })

  it('returns 404 when blueprint is missing', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubBlueprintPage.delete).not.toHaveBeenCalled()
  })

  it('returns 401 for non-owner user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubBlueprintPage.delete).not.toHaveBeenCalled()
  })

  it('propagates prisma deletion errors', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp_1',
      userId: 'user_1',
    })
    prisma.hubBlueprintPage.delete.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session, {})).rejects.toThrow('delete failed')
  })

  it('validates empty body schema', () => {
    expect(bodySchema.validate({}).error).toBeUndefined()
  })
})
