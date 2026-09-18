/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlers = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    capturedHandlers = handlers

    return jest.fn()
  }),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    githubIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/github.app', () => ({
  getInstallationTokenForOwner: jest.fn(),
  githubRequest: jest.fn(),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

// Import after mocks are set up so capturedHandlers is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/github')

const prisma = require('@/prisma/client').default
const {
  getInstallationTokenForOwner,
  githubRequest,
} = require('@/lib/github.app')

describe('auxiliary/skillset/ability/chatbotkit/integration/github', () => {
  const session = { user: { id: 'user-1' } }

  const parameters = {
    githubIntegrationId: 'integration-1',
    method: 'GET',
    path: '/repos/acme/demo/actions/jobs/1/logs',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.githubIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'integration-1',
      userId: 'user-1',
      appId: 'app-1',
      privateKey: 'key-1',
    })

    getInstallationTokenForOwner.mockResolvedValue('token-1')
  })

  describe('apiCall', () => {
    it('returns JSON results as they are', async () => {
      githubRequest.mockResolvedValue({ id: 1 })

      const result = await capturedHandlers.apiCall.fn(session, parameters)

      expect(result).toEqual({ id: 1 })
      expect(githubRequest).toHaveBeenCalledWith(parameters.path, {
        method: 'GET',
        body: undefined,
        token: 'token-1',
      })
    })

    it('normalizes no content to a success object', async () => {
      githubRequest.mockResolvedValue(null)

      const result = await capturedHandlers.apiCall.fn(session, parameters)

      expect(result).toEqual({ ok: true })
    })

    it('wraps text results in an object', async () => {
      githubRequest.mockResolvedValue('build ok')

      const result = await capturedHandlers.apiCall.fn(session, parameters)

      expect(result).toEqual({ text: 'build ok' })
    })
  })
})
