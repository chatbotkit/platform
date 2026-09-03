/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { validateGithubRequest } from '@/lib/github.signature'

import handler from '@/pages/api/v1/integration/github/[githubIntegrationId]/event'
import { sendEvent } from '@/pages/api/v1/integration/github/[githubIntegrationId]/queue'

import { createMocks } from 'node-mocks-http'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      githubIntegration: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/github.signature', () => ({
  validateGithubRequest: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/github/[githubIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  getHeader: jest.fn((req, header) => req.headers[header]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('GitHub Event Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createGithubRequest(
    payload,
    { githubIntegrationId = 'int-123', headers = {} } = {}
  ) {
    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})
    const { req } = createMocks({
      method: 'POST',
      query: { githubIntegrationId },
      headers: {
        'x-github-event': 'ping',
        'x-github-delivery': 'delivery-123',
        ...headers,
      },
      body,
    })

    // Mock arrayBuffer to return the body
    const encoder = new TextEncoder()
    const buffer = encoder.encode(body).buffer

    req.arrayBuffer = jest.fn().mockResolvedValue(buffer)

    return req
  }

  describe('integration not found', () => {
    it('should return 404 when integration does not exist', async () => {
      prisma.githubIntegration.findUnique.mockResolvedValue(null)

      const req = createGithubRequest({})

      const result = await handler(req)

      expect(result.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('ping event', () => {
    it('should respond with 200 to ping event', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        { zen: 'Hello World' },
        {
          headers: {
            'x-github-event': 'ping',
            'x-hub-signature-256': 'sha256=test',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('signature validation', () => {
    it('should reject deliveries when no webhook secret is configured', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: null,
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'attacker' },
          issue: { number: 1, pull_request: null },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: '@bot do something' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(403)
      expect(validateGithubRequest).not.toHaveBeenCalled()
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should validate GitHub HMAC signature', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        { action: 'opened' },
        {
          headers: {
            'x-github-event': 'issues',
            'x-hub-signature-256': 'sha256=valid',
          },
        }
      )

      await handler(req)

      expect(validateGithubRequest).toHaveBeenCalled()
    })

    it('should reject requests with invalid signature', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockRejectedValue(new Error('Invalid signature'))

      const req = createGithubRequest(
        { action: 'opened' },
        {
          headers: {
            'x-github-event': 'issues',
            'x-hub-signature-256': 'sha256=invalid',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('bot recursion guard', () => {
    it('should ignore comments from bot accounts', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'Bot', login: 'github-actions[bot]' },
          issue: { number: 1 },
          repository: { name: 'test-repo', owner: { login: 'org' } },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should ignore comments from users ending with [bot]', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'some-bot[bot]' },
          issue: { number: 1 },
          repository: { name: 'test-repo', owner: { login: 'org' } },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should process comments from regular users', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'real-user' },
          issue: { number: 1, pull_request: null },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'Test comment' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalled()
    })
  })

  describe('sender identity', () => {
    it('should forward the author association so the queue can check allowFrom', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'real-user' },
          issue: { number: 1, pull_request: null },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'Test comment', author_association: 'COLLABORATOR' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        'int-123',
        expect.objectContaining({
          type: 'interact',
          payload: expect.objectContaining({
            senderLogin: 'real-user',
            authorAssociation: 'COLLABORATOR',
          }),
        })
      )
    })

    it('should forward an undefined author association when absent', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'real-user' },
          issue: { number: 1, pull_request: null },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'Test comment' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        'int-123',
        expect.objectContaining({
          payload: expect.objectContaining({
            authorAssociation: undefined,
          }),
        })
      )
    })
  })

  describe('event type routing', () => {
    it('should handle issue_comment events', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'user' },
          issue: { number: 1, pull_request: null },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'comment' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalled()
    })

    it('should detect PR comments via pull_request field in issue', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'user' },
          issue: { number: 1, pull_request: { url: 'https://...' } },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'comment' },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalled()
    })

    it('should handle pull_request_review_comment events', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'user' },
          pull_request: { number: 1 },
          repository: { name: 'test-repo', owner: { login: 'org' } },
          comment: { body: 'comment' },
        },
        {
          headers: {
            'x-github-event': 'pull_request_review_comment',
          },
        }
      )

      await handler(req)

      expect(sendEvent).toHaveBeenCalled()
    })

    it('should acknowledge unhandled event types gracefully', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        { ref: 'refs/heads/main' },
        {
          headers: {
            'x-github-event': 'push',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('malformed data handling', () => {
    it('should handle missing repository field', async () => {
      const integration = {
        id: 'int-123',
        userId: 'user-456',
        webhookSecret: 'test-secret',
      }

      prisma.githubIntegration.findUnique.mockResolvedValue(integration)
      validateGithubRequest.mockResolvedValue(true)

      const req = createGithubRequest(
        {
          action: 'created',
          sender: { type: 'User', login: 'user' },
          issue: { number: 1 },
        },
        {
          headers: {
            'x-github-event': 'issue_comment',
          },
        }
      )

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})
