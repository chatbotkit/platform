/**
 * @jest-environment node
 */
import { getAbilityFunctionInput } from '@/lib/ability.function'
import { setContextNamespace, setContextUser } from '@/lib/context.store'
import { logEvent } from '@/lib/log'
import {
  authorizeSkillserverRequest,
  findSkillserverAbility,
  renderSkillserverManual,
} from '@/lib/skillserver'
import { applySkillset } from '@/lib/skillset.apply'
import { Usage } from '@/lib/usage.model'

import handler from '@/pages/api/v1/integration/skillserver/[skillserverIntegrationId]/invoke'

import { createMocks } from 'node-mocks-http'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillserverIntegration: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/ability.function', () => ({
  getAbilityFunctionInput: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/skillset.apply', () => ({
  applySkillset: jest.fn(),
}))

jest.mock('@/lib/skillserver', () => ({
  findSkillserverAbility: jest.fn(),
  renderSkillserverManual: jest.fn(),
  authorizeSkillserverRequest: jest.fn((req) => ({
    ok: true,
    integration: null,
  })),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn(),
  },
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: (msg) => ({ status: 404, body: msg }),
  badRequest: (msg) => ({ status: 400, body: msg }),
  send: (data, headers) => ({ status: 200, body: data, headers }),
  methodNotAllowed: () => ({ status: 405 }),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  queryParam: jest.fn((req, param) => req.query[param]),
  getHeader: jest.fn((req, header) => req.headers[header]),
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.example.com${path}`),
}))

describe('Skillserver Invoke Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createRequest(method = 'GET', body = null) {
    const { req } = createMocks({
      method,
      query: { skillserverIntegrationId: 'skillserver-123' },
      headers: {
        accept: 'application/json',
      },
    })

    if (method === 'POST' && body) {
      req.json = jest.fn().mockResolvedValue(body)
    } else if (method === 'GET') {
      req.json = jest.fn().mockRejectedValue(new Error('No body'))
    }

    return req
  }

  describe('GET - Manual endpoint', () => {
    it('should return manual for valid skillserver integration', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { name: 'My Skillset' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      renderSkillserverManual.mockReturnValue(
        '# Skillset Manual\n\nAbilities:...'
      )

      const req = createRequest('GET')

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.body).toContain('# Skillset Manual')
      expect(renderSkillserverManual).toHaveBeenCalledWith(
        integration,
        expect.any(Object)
      )
    })

    it('should return 404 when integration does not exist', async () => {
      authorizeSkillserverRequest.mockResolvedValue({
        ok: false,
        response: { status: 404 },
      })

      const req = createRequest('GET')

      const result = await handler(req)

      expect(result.status).toBe(404)
    })
  })

  describe('POST - Invoke endpoint', () => {
    it('should invoke ability with valid request', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789', name: 'My Skillset' },
        user: { id: 'user-456' },
      }

      const ability = {
        id: 'ability-1',
        name: 'search',
      }

      const input = { query: 'test' }
      const result = { answer: 'Result data' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue(input)
      applySkillset.mockResolvedValue({
        result,
        error: null,
        usage: { token: 100, model: 'gpt-4' },
      })

      const req = createRequest('POST', { ability: 'search', input })

      const response = await handler(req)

      expect(response.status).toBe(200)
      expect(response.body.result).toEqual(result)
      expect(response.body.error).toBeNull()
      expect(setContextUser).toHaveBeenCalledWith(integration.user)
      expect(setContextNamespace).toHaveBeenCalled()
      expect(applySkillset).toHaveBeenCalledWith(
        integration.userId,
        integration.skillset,
        ability.name,
        input
      )
      expect(Usage.createAndRecord).toHaveBeenCalled()
    })

    it('should return 400 when ability field is missing', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })

      const req = createRequest('POST', { input: {} })

      const result = await handler(req)

      expect(result.status).toBe(400)
      expect(result.body).toContain('Missing required field: ability')
    })

    it('should return 400 when ability is not a string', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })

      const req = createRequest('POST', { ability: 123, input: {} })

      const result = await handler(req)

      expect(result.status).toBe(400)
      expect(result.body).toContain('Missing required field: ability')
    })

    it('should return 400 for invalid JSON body', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })

      const { req } = createMocks({
        method: 'POST',
        query: { skillserverIntegrationId: 'skillserver-123' },
      })

      req.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'))

      const result = await handler(req)

      expect(result.status).toBe(400)
      expect(result.body).toContain('Request body must be valid JSON')
    })

    it('should return 404 when ability not found', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(null)

      const req = createRequest('POST', { ability: 'nonexistent', input: {} })

      const result = await handler(req)

      expect(result.status).toBe(404)
      expect(result.body).toContain('Ability not found')
    })

    it('should return 404 when skillset is missing', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: null,
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      const result = await handler(req)

      expect(result.status).toBe(404)
      expect(result.body).toContain('linked skillset no longer exists')
    })

    it('should handle ability execution errors', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: null,
        error: 'Search failed',
        usage: null,
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.body.error).toBe('Search failed')
      expect(result.body.result).toBeNull()
    })

    it('should establish context user for ability execution', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456', name: 'Test User' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: null,
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      await handler(req)

      expect(setContextUser).toHaveBeenCalledWith(integration.user)
    })

    it('should support custom session parameter for namespace', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: null,
      })

      const { req } = createMocks({
        method: 'POST',
        query: {
          skillserverIntegrationId: 'skillserver-123',
          session: 'custom-session-id',
        },
      })

      req.json = jest.fn().mockResolvedValue({ ability: 'search', input: {} })

      await handler(req)

      expect(setContextNamespace).toHaveBeenCalled()
    })

    it('should log ability execution event', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({ query: 'test' })
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: { token: 100, model: 'gpt-4' },
      })

      const req = createRequest('POST', {
        ability: 'search',
        input: { query: 'test' },
      })

      await handler(req)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-456' },
          type: 'action.skillserver.ability.invoke',
          relations: {
            skillserverIntegrationId: 'skillserver-123',
            skillsetId: 'skillset-789',
            abilityId: 'ability-1',
          },
        })
      )
    })

    it('should record usage when ability returns usage data', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: { token: 100, model: 'gpt-4' },
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      await handler(req)

      expect(Usage.createAndRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-456' },
          token: 100,
          model: 'gpt-4',
          meta: {
            reason: 'ability/execute',
          },
          references: {
            skillsetId: 'skillset-789',
          },
        })
      )
    })

    it('should not record usage when ability returns no usage data', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: null,
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      await handler(req)

      expect(Usage.createAndRecord).not.toHaveBeenCalled()
    })

    it('should return JSON format when format=json query param specified', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }
      const result = { data: 'test' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result,
        error: null,
        usage: null,
      })

      const { req } = createMocks({
        method: 'POST',
        query: {
          skillserverIntegrationId: 'skillserver-123',
          format: 'json',
        },
      })

      req.json = jest.fn().mockResolvedValue({ ability: 'search', input: {} })

      const response = await handler(req)

      expect(response.status).toBe(200)
      expect(response.body.result).toEqual(result)
    })

    it('should handle execution errors gracefully', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockRejectedValue(new Error('Execution failed'))

      const req = createRequest('POST', { ability: 'search', input: {} })

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.body).toContain('Error: Execution failed')
    })

    it('should not record usage when integration does not exist', async () => {
      authorizeSkillserverRequest.mockResolvedValue({
        ok: false,
        response: { status: 401 },
      })

      const { req } = createMocks({
        method: 'POST',
        query: { skillserverIntegrationId: 'nonexistent' },
      })

      req.json = jest.fn().mockResolvedValue({ ability: 'search', input: {} })

      await handler(req)

      expect(Usage.createAndRecord).not.toHaveBeenCalled()
    })
  })

  describe('HTTP method handling', () => {
    it('should handle GET requests for manual', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { name: 'My Skillset' },
        user: { id: 'user-456' },
      }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      renderSkillserverManual.mockReturnValue('# Manual')

      const req = createRequest('GET')

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(renderSkillserverManual).toHaveBeenCalled()
    })

    it('should handle POST requests for ability invocation', async () => {
      const integration = {
        id: 'skillserver-123',
        userId: 'user-456',
        skillset: { id: 'skillset-789' },
        user: { id: 'user-456' },
      }

      const ability = { id: 'ability-1', name: 'search' }

      authorizeSkillserverRequest.mockResolvedValue({
        ok: true,
        integration,
      })
      findSkillserverAbility.mockReturnValue(ability)
      getAbilityFunctionInput.mockReturnValue({})
      applySkillset.mockResolvedValue({
        result: 'data',
        error: null,
        usage: null,
      })

      const req = createRequest('POST', { ability: 'search', input: {} })

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(applySkillset).toHaveBeenCalled()
    })
  })
})
