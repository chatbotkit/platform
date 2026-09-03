/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './unpublish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubSkillsetPage: {
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

const prisma = require('@/prisma/client').default

describe('/api/v1/hub/skillset/[skillsetId]/unpublish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { skillsetId: 'skillset_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and deleted hub page id for owner', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'skillset_1',
      userId: 'user_1',
    })
    prisma.hubSkillsetPage.delete.mockResolvedValue({ id: 'hub_page_1' })

    const result = await handler(req, session, {})

    expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'skillset_1'
    )
    expect(prisma.hubSkillsetPage.delete).toHaveBeenCalledWith({
      where: { skillsetId: 'skillset_1' },
      select: { id: true },
    })
    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_page_1', skillsetId: 'skillset_1' },
    })
  })

  it('returns 404 when skillset is missing', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubSkillsetPage.delete).not.toHaveBeenCalled()
  })

  it('returns 401 for non-owner user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'skillset_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubSkillsetPage.delete).not.toHaveBeenCalled()
  })

  it('propagates prisma deletion errors', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'skillset_1',
      userId: 'user_1',
    })
    prisma.hubSkillsetPage.delete.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session, {})).rejects.toThrow('delete failed')
  })

  it('validates empty body schema', () => {
    expect(bodySchema.validate({}).error).toBeUndefined()
  })
})
