/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { deleteSkillset } from '@/lib/skillset.delete'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/skillset.delete', () => ({
  deleteSkillset: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/skillset/[skillsetId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when skillset does not exist', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(deleteSkillset).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset is owned by another user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(deleteSkillset).not.toHaveBeenCalled()
  })

  it('deletes skillset and returns id for owner', async () => {
    const skillset = { id: 'ss-1', userId: 'user-1' }

    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(skillset)

    const result = await handler(req, session)

    expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'ss-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(deleteSkillset).toHaveBeenCalledWith(skillset)
    expect(result).toEqual({ status: 200, body: { id: 'ss-1' } })
  })
})
