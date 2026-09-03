/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mocked-webhook-secret-hex'),
  })),
}))

describe('/api/v1/integration/github/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  function createdData() {
    return prisma.githubIntegration.create.mock.calls[0][0].data
  }

  beforeEach(() => {
    mockReset(prisma)

    prisma.githubIntegration.create.mockResolvedValue({ id: 'gh-1' })
  })

  describe('allowFrom', () => {
    it('leaves an omitted allowFrom to the column default rather than substituting one', async () => {
      // @note the `@collaborators` default lives on the column so that every
      // write path gets it, not just this endpoint - see schema.prisma
      await handler(makeReq(), mockSession, { name: 'Repo Assistant' })

      expect(createdData().allowFrom).toBeUndefined()
    })

    it('stores an explicit allowFrom as provided', async () => {
      await handler(makeReq(), mockSession, {
        name: 'Repo Assistant',
        allowFrom: '@octocat,chatbotkit/*',
      })

      expect(createdData().allowFrom).toBe('@octocat,chatbotkit/*')
    })

    it('honours an explicit wildcard opt-in', async () => {
      await handler(makeReq(), mockSession, {
        name: 'Repo Assistant',
        allowFrom: '*',
      })

      expect(createdData().allowFrom).toBe('*')
    })

    it('keeps an explicit empty allowFrom as deny-all', async () => {
      await handler(makeReq(), mockSession, {
        name: 'Repo Assistant',
        allowFrom: '',
      })

      expect(createdData().allowFrom).toBe('')
    })

    it('keeps an explicit null allowFrom as null', async () => {
      await handler(makeReq(), mockSession, {
        name: 'Repo Assistant',
        allowFrom: null,
      })

      expect(createdData().allowFrom).toBeNull()
    })
  })
})
