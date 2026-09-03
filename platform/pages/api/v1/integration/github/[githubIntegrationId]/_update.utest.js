/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, existing) => meta ?? existing),
}))

jest.mock(
  '@/pages/api/v1/integration/github/[githubIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

describe('POST /api/v1/integration/github/[githubIntegrationId]/update', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({ query: { githubIntegrationId: 'gh-123' } })

  function updatedData() {
    return prisma.githubIntegration.update.mock.calls[0][0].data
  }

  beforeEach(() => {
    mockReset(prisma)

    prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'gh-123',
      userId: 'user-123',
      meta: {},
    })

    prisma.githubIntegration.update.mockResolvedValue({ id: 'gh-123' })
  })

  describe('credential sentinel', () => {
    it('leaves privateKey and webhookSecret untouched when the sentinel is echoed back', async () => {
      const result = await handler(makeReq(), mockSession, {
        name: 'Renamed',
        privateKey: '********',
        webhookSecret: '********',
      })

      expect(result.status).toBe(200)

      const data = updatedData()

      // undefined means prisma will not update the column
      expect(data.privateKey).toBeUndefined()
      expect(data.webhookSecret).toBeUndefined()
      expect(data.name).toBe('Renamed')
    })

    it('stores new credentials when real values are provided', async () => {
      await handler(makeReq(), mockSession, {
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nnew',
        webhookSecret: 'rotated-secret',
      })

      const data = updatedData()

      expect(data.privateKey).toBe('-----BEGIN RSA PRIVATE KEY-----\nnew')
      expect(data.webhookSecret).toBe('rotated-secret')
    })

    it('clears privateKey on null but never clears webhookSecret', async () => {
      await handler(makeReq(), mockSession, {
        privateKey: null,
        webhookSecret: '',
      })

      const data = updatedData()

      expect(data.privateKey).toBeNull()
      // @note an integration without a webhook secret cannot verify
      // deliveries, so a blank leaves it alone
      expect(data.webhookSecret).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('returns 404 when the integration does not exist', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(404)
    })

    it('returns 403 when the integration belongs to another user', async () => {
      prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'gh-123',
        userId: 'other-user',
      })

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(403)
    })
  })
})
