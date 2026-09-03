/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'

import handler from '@/pages/api/v1/integration/mcpserver/[mcpserverIntegrationId]/mcp'

import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      findUnique: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/ability.function', () => ({
  getAbilityFunctionName: jest.fn((ability) => ability.name),
  getAbilityFunctionDescription: jest.fn(
    (ability) => ability.description || 'Test description'
  ),
  getAbilityFunctionParameters: jest.fn(() => ({
    type: 'object',
    properties: {},
  })),
  getAbilityFunctionInput: jest.fn((ability, args) => args),
}))

jest.mock('@/lib/context.store', () => ({
  runInContext: jest.fn((fn) => fn),
  setContextNamespace: jest.fn(),
  setContextNextApiRequest: jest.fn(),
  setContextNextApiResponse: jest.fn(),
  setContextUser: jest.fn(),
  setContextRequest: jest.fn(),
  setContextRequestHost: jest.fn(),
  setContextRequestIpAddress: jest.fn(),
  setContextRequestProtocol: jest.fn(),
  setContextRequestQuery: jest.fn(),
  setContextRequestStartTime: jest.fn(),
  setContextRequestUserAgent: jest.fn(),
  setContextTimezone: jest.fn(),
  getContextAPIHost: jest.fn(),
  getContextFrontendHost: jest.fn(() => 'https://chatbotkit.com'),
  getContextRequestHost: jest.fn(),
  getContextStaticHost: jest.fn(),
  getContextWidgetHost: jest.fn(),
  setContextAPIHost: jest.fn(),
  setContextFrontendHost: jest.fn(),
  setContextStaticHost: jest.fn(),
  setContextWidgetHost: jest.fn(),
}))

jest.mock('@/lib/defer', () => ({
  runInDeferred: jest.fn((fn) => fn),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureException: jest.fn(),
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn((req, name) => {
    return req.headers[name.toLowerCase()] || null
  }),
  getTimezoneHeader: jest.fn((req) => req.headers['x-timezone'] || null),
  getUserAgentHeader: jest.fn(() => 'test-user-agent'),
}))

jest.mock('@/lib/header.assertion', () => ({
  injectInternalAssertionContext: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  getQuery: jest.fn((req) => req.query || {}),
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  queryParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/skillset.apply', () => ({
  applySkillset: jest.fn().mockResolvedValue({
    usage: {
      token: 100,
      model: 'test-model',
    },
    error: null,
    result: { success: true, data: 'test result' },
    messages: [],
  }),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/lib/namespace.safe', () => ({
  getSafeNamespace: jest.fn(
    (user, sessionId) => `namespace-${user.id}-${sessionId}`
  ),
}))

jest.mock('@/lib/mcp.session', () => ({
  getOrCreateSession: jest.fn().mockResolvedValue('test-session-123'),
}))

jest.mock('@/lib/mcp.widget', () => ({
  getAllowedWidgetDomains: jest.fn(
    () => new Set(['unpkg.com', 'cdn.jsdelivr.net'])
  ),
  parseWidgetUiValue: jest.fn(() => null),
}))

jest.mock('@/lib/oauth.jwt', () => ({
  hasScope: jest.fn(() => true),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
  verifyOAuthToken: jest.fn().mockResolvedValue(null),
}))

const mockServerClose = jest.fn().mockResolvedValue(undefined)
const mockServerConnect = jest.fn().mockResolvedValue(undefined)
const mockServerSetRequestHandler = jest.fn()

const mockTransportClose = jest.fn().mockResolvedValue(undefined)
const mockTransportHandleRequest = jest.fn().mockResolvedValue(undefined)

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    close: mockServerClose,
    connect: mockServerConnect,
    setRequestHandler: mockServerSetRequestHandler,
  })),
}))

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
    handleRequest: mockTransportHandleRequest,
  })),
}))

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}))

describe('MCP server integration endpoint', () => {
  let mockIntegration

  beforeEach(() => {
    jest.clearAllMocks()

    const {
      verifyOAuthToken,
      isTokenRevoked,
      hasScope,
    } = require('@/lib/oauth.jwt')

    // @note clearAllMocks does not reset mockResolvedValue; reset defaults per test
    verifyOAuthToken.mockResolvedValue(null)
    isTokenRevoked.mockResolvedValue(false)
    hasScope.mockImplementation(() => true)

    // Reset mock implementations
    mockServerClose.mockClear().mockResolvedValue(undefined)
    mockServerConnect.mockClear().mockResolvedValue(undefined)
    mockServerSetRequestHandler.mockClear()
    mockTransportClose.mockClear().mockResolvedValue(undefined)
    mockTransportHandleRequest.mockClear().mockResolvedValue(undefined)

    // Reset ability function mocks to defaults
    const {
      getAbilityFunctionName,
      getAbilityFunctionDescription,
      getAbilityFunctionParameters,
      getAbilityFunctionInput,
    } = require('@/lib/ability.function')

    getAbilityFunctionName.mockImplementation((ability) => ability.name)
    getAbilityFunctionDescription.mockImplementation(
      (ability) => ability.description || 'Test description'
    )
    getAbilityFunctionParameters.mockImplementation(() => ({
      type: 'object',
      properties: {},
    }))
    getAbilityFunctionInput.mockImplementation((ability, args) => args)

    // Default mock integration
    mockIntegration = {
      id: 'integration-123',
      name: 'Test MCP Server',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'user@example.com',
      },
      accessToken: 'valid-token-123',
      skillset: {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-1',
            name: 'test_ability',
            description: 'Test ability description',
            instruction: 'Test instruction',
            meta: {},
          },
        ],
      },
    }
  })

  describe('validation and error handling', () => {
    it('should return 400 when mcpserverIntegrationId is missing', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: {}, // Missing mcpserverIntegrationId
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Missing mcpserverIntegrationId',
      })
    })

    it('should return 401 when authorization header is missing', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {}, // Missing authorization
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Missing access token',
      })
    })

    it('should return 404 when integration is not found', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'nonexistent-integration',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'McpServer integration not found',
      })
    })

    it('should return 401 when oauth token is revoked', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { verifyOAuthToken, isTokenRevoked } = require('@/lib/oauth.jwt')

      verifyOAuthToken.mockResolvedValue({
        sub: 'user-123',
        portalId: 'portal-123',
        portalUserId: 'portal-user-123',
        contactId: 'contact-123',
        scope: 'mcp:tools mcp:resources',
        aud: 'mcp',
      })

      isTokenRevoked.mockResolvedValue(true)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer revoked-jwt-token',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'invalid_token',
        error_description: 'Token has been revoked',
      })
    })

    it('rejects an OAuth token issued for a different integration', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { verifyOAuthToken, isTokenRevoked } = require('@/lib/oauth.jwt')

      // @note a valid, unrevoked token - but minted by integration A
      verifyOAuthToken.mockResolvedValue({
        sub: 'user-123',
        portalId: 'integration-A',
        portalUserId: 'portal-user-123',
        contactId: 'contact-123',
        scope: 'mcp:tools mcp:resources',
        aud: 'mcp',
      })
      isTokenRevoked.mockResolvedValue(false)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer token-from-integration-A',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'invalid_token',
        error_description: 'Token was not issued for this resource',
      })
    })

    it('should return 401 when access token is invalid', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer wrong-token',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid access token',
      })
    })

    it('should handle Bearer token with different casing', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Should not return 401 error for valid token
      expect(res._getStatusCode()).not.toBe(401)
    })

    it('should require an oauth jwt when oauth connection is configured even if the static token is valid in the query', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        oAuthConnectionId: 'oauth-123',
      })

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
          authorization: 'valid-token-123',
        },
        headers: {},
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'invalid_token',
        error_description: 'OAuth token is required',
      })
      expect(String(res.getHeader('WWW-Authenticate'))).toContain(
        'resource_metadata='
      )
    })

    it('should require an oauth jwt when oauth connection is configured even if the static token is valid in the header', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        oAuthConnectionId: 'oauth-123',
      })

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toEqual({
        error: 'invalid_token',
        error_description: 'OAuth token is required',
      })
      expect(String(res.getHeader('WWW-Authenticate'))).toContain(
        'resource_metadata='
      )
    })

    it('should allow access when oauth connection is configured and both static token and oauth jwt are valid', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        oAuthConnectionId: 'oauth-123',
      })

      const { verifyOAuthToken } = require('@/lib/oauth.jwt')

      verifyOAuthToken.mockResolvedValue({
        sub: 'user-123',
        portalId: 'integration-123',
        portalUserId: 'user-123',
        contactId: '',
        scope: 'mcp:tools mcp:resources',
        aud: 'mcp',
      })

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
          authorization: 'valid-token-123',
        },
        headers: {
          authorization: 'Bearer valid-jwt-token',
        },
        body: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).not.toBe(401)
    })
  })

  describe('MCP server initialization', () => {
    it('should initialize MCP server with correct configuration', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      const { Server } = require('@modelcontextprotocol/sdk/server/index.js')

      expect(Server).toHaveBeenCalledWith(
        {
          name: 'test-mcp-server',
          title: 'Test MCP Server',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      )
    })

    it('should register tools from abilities', async () => {
      mockIntegration.skillset.abilities = [
        {
          id: 'ability-1',
          name: 'test_ability_1',
          description: 'First test ability',
          instruction: 'Test instruction 1',
          meta: {},
        },
        {
          id: 'ability-2',
          name: 'test_ability_2',
          description: 'Second test ability',
          instruction: 'Test instruction 2',
          meta: {},
        },
      ]

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Should set up request handlers for ListTools and CallTool
      expect(mockServerSetRequestHandler).toHaveBeenCalledTimes(2)
      expect(mockServerSetRequestHandler).toHaveBeenCalledWith(
        'ListToolsRequestSchema',
        expect.any(Function)
      )
      expect(mockServerSetRequestHandler).toHaveBeenCalledWith(
        'CallToolRequestSchema',
        expect.any(Function)
      )
    })

    it('should handle integration with no skillset', async () => {
      const integrationWithoutSkillset = {
        ...mockIntegration,
        skillset: null,
      }

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(
        integrationWithoutSkillset
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Should still initialize server without errors
      expect(mockServerConnect).toHaveBeenCalled()
    })

    it('should handle integration with empty abilities array', async () => {
      mockIntegration.skillset.abilities = []

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Should still initialize server without errors
      expect(mockServerConnect).toHaveBeenCalled()
    })
  })

  describe('MCP server request handlers', () => {
    it('should handle ListTools request', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the ListTools handler
      const listToolsHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'ListToolsRequestSchema'
      )?.[1]

      expect(listToolsHandler).toBeDefined()

      const result = listToolsHandler()

      expect(result).toMatchObject({
        tools: [
          {
            name: 'test_ability',
            description: 'Test ability description',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            annotations: {
              title: 'test_ability',
            },
          },
        ],
      })
    })

    it('should exclude disabled abilities from the tools list', async () => {
      mockIntegration.skillset.abilities = [
        {
          id: 'ability-live',
          name: 'live_ability',
          description: 'Live',
          instruction: '',
          meta: {},
          state: 'enabled',
        },
        {
          id: 'ability-off',
          name: 'off_ability',
          description: 'Off',
          instruction: '',
          meta: {},
          state: 'disabled',
        },
      ]

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      const listToolsHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'ListToolsRequestSchema'
      )?.[1]

      const names = listToolsHandler().tools.map((tool) => tool.name)

      expect(names).toContain('live_ability')
      expect(names).not.toContain('off_ability')
    })

    it('should handle CallTool request for unknown tool', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the CallTool handler
      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      expect(callToolHandler).toBeDefined()

      const result = await callToolHandler({
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unknown tool: nonexistent_tool',
          },
        ],
        isError: true,
      })
    })

    it('should handle CallTool request when skillset is not found', async () => {
      const integrationWithoutSkillset = {
        ...mockIntegration,
        skillset: null,
      }

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(
        integrationWithoutSkillset
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the CallTool handler
      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      expect(callToolHandler).toBeDefined()

      const result = await callToolHandler({
        params: {
          name: 'test_ability',
          arguments: {},
        },
      })

      // When skillset is null, tools array is empty, so "Unknown tool" is expected
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unknown tool: test_ability',
          },
        ],
        isError: true,
      })
    })

    // @note The "Skillset not found" (lines 184-193) and "Ability not found" (lines 201-210)
    // error paths are defensive checks that are difficult to trigger in practice because:
    // - If skillset is null, the tools array is empty, so "Unknown tool" is returned first
    // - If ability is not found, it means the nameToAbilityIdMapping is corrupted, which
    //   should not happen in normal operation since both are built from the same source
    // These paths exist for safety but require internal state corruption to trigger.

    it('should handle successful CallTool request', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')

      applySkillset.mockResolvedValue({
        usage: {
          token: 150,
          model: 'gpt-4',
        },
        error: null,
        result: { success: true, data: 'execution result' },
        messages: [],
      })

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the CallTool handler
      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      const result = await callToolHandler({
        params: {
          name: 'test_ability',
          arguments: { input: 'test' },
        },
      })

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data: 'execution result' }),
          },
        ],
        isError: false,
        structuredContent: {
          result: { success: true, data: 'execution result' },
        },
        _meta: {
          mcpserverIntegrationId: 'integration-123',
        },
      })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        mockIntegration.skillset,
        'test_ability',
        { input: 'test' }
      )
    })

    it('should set context user before executing MCP tools', async () => {
      const { setContextUser } = require('@/lib/context.store')

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      await callToolHandler({
        params: {
          name: 'test_ability',
          arguments: { input: 'test' },
        },
      })

      expect(setContextUser).toHaveBeenCalledWith(mockIntegration.user)
    })

    it('should handle CallTool request with execution error', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const { captureException } = require('@/lib/error')

      applySkillset.mockRejectedValue(new Error('Execution failed'))

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the CallTool handler
      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      const result = await callToolHandler({
        params: {
          name: 'test_ability',
          arguments: {},
        },
      })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error: Execution failed',
          },
        ],
        isError: true,
      })

      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should record usage after successful execution', async () => {
      const { Usage } = require('@/lib/usage.model')
      const { applySkillset } = require('@/lib/skillset.apply')

      applySkillset.mockResolvedValue({
        usage: {
          token: 200,
          model: 'gpt-4-turbo',
        },
        error: null,
        result: { success: true },
        messages: [],
      })

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      await handler(req, res)

      // Get the CallTool handler and execute it
      const callToolHandler = mockServerSetRequestHandler.mock.calls.find(
        (call) => call[0] === 'CallToolRequestSchema'
      )?.[1]

      await callToolHandler({
        params: {
          name: 'test_ability',
          arguments: { input: 'test' },
        },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        token: 200,
        model: 'gpt-4-turbo',
        meta: {
          reason: 'ability/execute',
        },
        references: {
          skillsetId: 'skillset-123',
        },
      })

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        name: 'MCP Tool Call',
        description: 'Executed MCP tool test_ability',
        type: 'action.mcpserver.tool.call',
        relations: {
          mcpserverIntegrationId: 'integration-123',
          skillsetId: 'skillset-123',
          abilityId: 'ability-1',
        },
        meta: {
          toolName: 'test_ability',
          arguments: { input: 'test' },
          client: 'unknown',
        },
      })
    })
  })

  describe('resource cleanup and destruction', () => {
    it('should close server when response close event fires', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      // Capture event listeners
      const closeHandlers = []
      const originalOn = res.on

      res.on = jest.fn((event, handler) => {
        if (event === 'close') {
          closeHandlers.push(handler)
        }

        return originalOn.call(res, event, handler)
      })

      await handler(req, res)

      // Verify server.close was not called yet
      expect(mockServerClose).not.toHaveBeenCalled()

      // Trigger close event
      for (const handler of closeHandlers) {
        await handler()
      }

      // Verify server.close was called
      expect(mockServerClose).toHaveBeenCalledTimes(1)
    })

    it('should close transport when response close event fires', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      // Capture event listeners
      const closeHandlers = []
      const originalOn = res.on

      res.on = jest.fn((event, handler) => {
        if (event === 'close') {
          closeHandlers.push(handler)
        }

        return originalOn.call(res, event, handler)
      })

      await handler(req, res)

      // Verify transport.close was not called yet
      expect(mockTransportClose).not.toHaveBeenCalled()

      // Trigger close event
      for (const handler of closeHandlers) {
        await handler()
      }

      // Verify transport.close was called
      expect(mockTransportClose).toHaveBeenCalledTimes(1)
    })

    it('should close both server and transport when response closes', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      // Capture event listeners
      const closeHandlers = []
      const originalOn = res.on

      res.on = jest.fn((event, handler) => {
        if (event === 'close') {
          closeHandlers.push(handler)
        }

        return originalOn.call(res, event, handler)
      })

      await handler(req, res)

      // Verify neither close method was called yet
      expect(mockServerClose).not.toHaveBeenCalled()
      expect(mockTransportClose).not.toHaveBeenCalled()

      // Trigger all close event handlers
      for (const handler of closeHandlers) {
        await handler()
      }

      // Verify both close methods were called exactly once
      expect(mockServerClose).toHaveBeenCalledTimes(1)
      expect(mockTransportClose).toHaveBeenCalledTimes(1)
    })

    // @note The code uses `void server.close()` and `void transport.close()` which intentionally
    // ignore promise rejections. Testing error handling for close() methods would require catching
    // unhandled rejections, which would interfere with Jest's error detection. The void operator
    // is used precisely to prevent errors during cleanup from affecting the response.

    it('should complete full lifecycle: initialize, connect, handle, cleanup', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: {},
      })

      // Capture event listeners
      const closeHandlers = []
      const originalOn = res.on

      res.on = jest.fn((event, handler) => {
        if (event === 'close') {
          closeHandlers.push(handler)
        }

        return originalOn.call(res, event, handler)
      })

      // Initialize and handle request
      await handler(req, res)

      // Verify initialization phase
      expect(mockServerConnect).toHaveBeenCalledTimes(1)
      expect(mockTransportHandleRequest).toHaveBeenCalledWith(req, res, {})

      // Verify cleanup is not done yet
      expect(mockServerClose).not.toHaveBeenCalled()
      expect(mockTransportClose).not.toHaveBeenCalled()

      // Trigger cleanup phase
      for (const handler of closeHandlers) {
        await handler()
      }

      // Verify cleanup phase
      expect(mockServerClose).toHaveBeenCalledTimes(1)
      expect(mockTransportClose).toHaveBeenCalledTimes(1)
    })

    it('should ensure no resource leaks after multiple requests', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      // Simulate multiple requests
      for (let i = 0; i < 3; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          query: {
            mcpserverIntegrationId: 'integration-123',
          },
          headers: {
            authorization: 'Bearer valid-token-123',
          },
          body: {},
        })

        // Capture event listeners
        const closeHandlers = []
        const originalOn = res.on

        res.on = jest.fn((event, handler) => {
          if (event === 'close') {
            closeHandlers.push(handler)
          }

          return originalOn.call(res, event, handler)
        })

        await handler(req, res)

        // Trigger cleanup
        for (const handler of closeHandlers) {
          await handler()
        }
      }

      // Each request should have triggered connect and close exactly once
      expect(mockServerConnect).toHaveBeenCalledTimes(3)
      expect(mockServerClose).toHaveBeenCalledTimes(3)
      expect(mockTransportClose).toHaveBeenCalledTimes(3)
    })
  })

  describe('integration with MCP transport', () => {
    it('should initialize transport and connect server', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: { test: 'data' },
      })

      await handler(req, res)

      const {
        StreamableHTTPServerTransport,
      } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')

      expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
        sessionIdGenerator: undefined,
      })

      expect(mockServerConnect).toHaveBeenCalled()
      expect(mockTransportHandleRequest).toHaveBeenCalledWith(req, res, {
        test: 'data',
      })
    })

    it('should pass request body to transport.handleRequest', async () => {
      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const requestBody = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
        body: requestBody,
      })

      await handler(req, res)

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(
        req,
        res,
        requestBody
      )
    })
  })

  describe('context and request tracking', () => {
    it('should set up request context correctly', async () => {
      const {
        setContextNextApiRequest,
        setContextNextApiResponse,
        setContextRequestStartTime,
        setContextRequest,
        setContextRequestHost,
        setContextRequestQuery,
        setContextTimezone,
        setContextRequestUserAgent,
      } = require('@/lib/context.store')

      prisma.mcpserverIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          mcpserverIntegrationId: 'integration-123',
          extra: 'param',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
          host: 'localhost',
          'x-timezone': 'America/New_York',
        },
        body: {},
      })

      await handler(req, res)

      expect(setContextNextApiRequest).toHaveBeenCalledWith(req)
      expect(setContextNextApiResponse).toHaveBeenCalledWith(res)
      expect(setContextRequest).toHaveBeenCalledWith(req)
      expect(setContextRequestStartTime).toHaveBeenCalledWith(
        expect.any(Number)
      )
      expect(setContextRequestHost).toHaveBeenCalledWith('localhost')
      expect(setContextRequestQuery).toHaveBeenCalled()
      expect(setContextTimezone).toHaveBeenCalledWith('America/New_York')
      expect(setContextRequestUserAgent).toHaveBeenCalledWith('test-user-agent')
    })
  })

  describe('GET request handling', () => {
    // @note GET requests are rejected with 405 to prevent SSE connections
    // that would keep serverless functions alive until the 800s Vercel timeout

    it('should reject GET requests with 405 Method Not Allowed', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
          accept: 'text/event-stream',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)

      const data = JSON.parse(res._getData())

      expect(data.jsonrpc).toBe('2.0')
      expect(data.error.code).toBe(-32000)
      expect(data.error.message).toContain('Method not allowed')
      expect(data.id).toBeNull()
    })

    it('should not attempt to handle GET requests with transport', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      })

      await handler(req, res)

      // Transport should never be invoked for GET requests
      expect(mockTransportHandleRequest).not.toHaveBeenCalled()

      // Server should never be created for GET requests
      expect(mockServerConnect).not.toHaveBeenCalled()
    })

    it('should return 405 before any database queries for GET requests', async () => {
      // Reset to track if findUnique was called
      prisma.mcpserverIntegration.findUnique.mockClear()

      const { req, res } = createMocks({
        method: 'GET',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)

      // No database queries should be made for GET requests
      expect(prisma.mcpserverIntegration.findUnique).not.toHaveBeenCalled()
    })

    it('should complete handler promptly for GET requests', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          mcpserverIntegrationId: 'integration-123',
        },
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      })

      const startTime = Date.now()

      await handler(req, res)

      const elapsed = Date.now() - startTime

      // GET requests should be rejected immediately (well under 1 second)
      expect(elapsed).toBeLessThan(1000)
      expect(res._getStatusCode()).toBe(405)
    })
  })
})
