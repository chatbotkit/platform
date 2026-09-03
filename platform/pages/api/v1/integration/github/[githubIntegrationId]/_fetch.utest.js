/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

describe('GET /api/v1/integration/github/[githubIntegrationId]/fetch', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeIntegration = (overrides = {}) => ({
    id: 'gh-123',
    alias: null,
    name: 'Repo Assistant',
    description: '',
    userId: 'user-123',
    blueprintId: null,
    botId: 'bot-789',
    appId: '12345',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----',
    webhookSecret: 'wh-secret-hex',
    contactCollection: false,
    sessionDuration: 3600000,
    allowFrom: '@collaborators',
    meta: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  })

  const makeReq = () => ({ query: { githubIntegrationId: 'gh-123' } })

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('credential output policy', () => {
    it('masks privateKey and reveals webhookSecret', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(
        makeIntegration()
      )

      const result = await handler(makeReq(), mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.id).toBe('gh-123')
      expect(data.appId).toBe('12345')
      expect(data.privateKey).toBe('********')
      expect(JSON.stringify(data)).not.toContain('BEGIN RSA PRIVATE KEY')
      // @note the webhook secret is what the user pastes into GitHub, so it
      // is revealed to the owner - see lib/credential.policy.ts
      expect(data.webhookSecret).toBe('wh-secret-hex')
      expect(data).not.toHaveProperty('userId')
    })

    it('returns privateKey as null when not configured', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(
        makeIntegration({ privateKey: null, webhookSecret: null })
      )

      const data = await (await handler(makeReq(), mockSession)).json()

      expect(data.privateKey).toBeNull()
      expect(data.webhookSecret).toBeNull()
    })

    it('selects the credential columns it masks', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(
        makeIntegration()
      )

      await handler(makeReq(), mockSession)

      expect(
        prisma.githubIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'gh-123',
        expect.objectContaining({
          select: expect.objectContaining({
            privateKey: true,
            webhookSecret: true,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('returns 404 when the integration does not exist', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(makeReq(), mockSession)

      expect(result.status).toBe(404)
    })

    it('returns 403 when the integration belongs to another user', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(
        makeIntegration({ userId: 'other-user' })
      )

      const result = await handler(makeReq(), mockSession)

      expect(result.status).toBe(403)
    })
  })
})
