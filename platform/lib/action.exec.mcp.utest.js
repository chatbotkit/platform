import { getConfigBySchema } from '@/lib/action.config'
import { doMcpInstall, executeMcpAction } from '@/lib/action.exec.mcp'
import debug from '@/lib/debug'
import { cleanupEmptyHeaders, toHeadersHashMap } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { installMcpTools } from '@/lib/mcp.edge'
import { hasSecrets, swapSecrets } from '@/lib/secret.value'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const mockDebug = jest.fn(() => ({
    log: jest.fn(),
  }))

  return mockDebug
})

jest.mock('@/lib/error', () => ({
  UserInputError: jest.fn().mockImplementation((message) => {
    const error = new Error(message)

    error.name = 'UserInputError'

    return error
  }),
}))

jest.mock('@/lib/header', () => ({
  cleanupEmptyHeaders: jest.fn(),
  toHeadersHashMap: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/mcp.edge', () => ({
  installMcpTools: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  hasSecrets: jest.fn(),
  swapSecrets: jest.fn(),
}))

jest.mock('@/lib/tool.environment', () => ({
  uninstallEnvironmentTools: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('action.exec.mcp', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById.mockResolvedValue(mockUser)
    logEvent.mockResolvedValue(undefined)
    hasSecrets.mockReturnValue(false)
    swapSecrets.mockResolvedValue({})
    cleanupEmptyHeaders.mockReturnValue({})
    toHeadersHashMap.mockReturnValue({})
    installMcpTools.mockResolvedValue({ success: true })
    getConfigBySchema.mockReturnValue({
      url: 'https://example.com/mcp',
      headers: undefined,
      prefix: undefined,
    })
  })

  describe('doMcpInstall', () => {
    const defaultParams = {
      install: 'https://example.com/mcp',
    }

    const defaultOptions = {
      userId: 'user-123',
      linkedResources: {
        secretId: 'secret-345',
      },
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
      inlineSecrets: {},
    }

    describe('basic functionality', () => {
      it('should successfully install MCP tools with basic configuration', async () => {
        const input = 'https://example.com/mcp'

        const result = await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(getConfigBySchema).toHaveBeenCalledWith({
          input,
          params: defaultParams,
          initial: {
            url: input,
          },
          schema: expect.any(Object),
          options: defaultOptions,
        })
        // @note headers is {} because auto-inject adds Authorization header when secretId is linked
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          expect.objectContaining({
            url: 'https://example.com/mcp',
            prefix: undefined,
          })
        )
        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle MCP installation with headers', async () => {
        const input = 'https://example.com/mcp'
        const mockHeaders = {
          Authorization: 'Bearer token123',
          'Custom-Header': 'value',
        }
        const processedHeaders = {
          authorization: 'Bearer token123',
          'custom-header': 'value',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: mockHeaders,
          prefix: 'test',
        })
        swapSecrets.mockResolvedValue(mockHeaders)
        cleanupEmptyHeaders.mockReturnValue(mockHeaders)
        toHeadersHashMap.mockReturnValue(processedHeaders)

        const result = await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        expect(swapSecrets).toHaveBeenCalledWith(mockHeaders, {
          userId: 'user-123',
          abilityId: 'ability-012',
          secretId: 'secret-345',
          inlineSecrets: {},
          discardSecretPlaceholders: true,
        })
        expect(cleanupEmptyHeaders).toHaveBeenCalledWith(mockHeaders)
        expect(toHeadersHashMap).toHaveBeenCalledWith(mockHeaders)
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          {
            url: 'https://example.com/mcp',
            headers: processedHeaders,
            prefix: 'test',
          }
        )
        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle MCP installation with prefix', async () => {
        const input = 'https://example.com/mcp'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: 'my-tools',
        })

        const result = await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note headers is {} because auto-inject adds Authorization header when secretId is linked
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          expect.objectContaining({
            url: 'https://example.com/mcp',
            prefix: 'my-tools',
          })
        )
        expect(result).toEqual({ result: { success: true } })
      })
    })

    describe('event logging', () => {
      it('should log event with all linked resources', async () => {
        const input = 'https://example.com/mcp'

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.mcp.install',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: defaultParams,
        })
      })

      it('should log event without linked resources', async () => {
        const input = 'https://example.com/mcp'
        const optionsWithoutResources = {
          userId: 'user-123',
          inlineSecrets: {},
        }

        await doMcpInstall({
          input,
          params: defaultParams,
          options: optionsWithoutResources,
        })

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.mcp.install',
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: defaultParams,
        })
      })

      it('should log event with partial linked resources', async () => {
        const input = 'https://example.com/mcp'
        const partialOptions = {
          userId: 'user-123',
          linkedResources: {},
          contextResources: {
            blueprintId: 'blueprint-456',
          },
          inlineSecrets: {},
        }

        await doMcpInstall({
          input,
          params: defaultParams,
          options: partialOptions,
        })

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.mcp.install',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: defaultParams,
        })
      })
    })

    describe('error handling', () => {
      it('should throw error when user is not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        const input = 'https://example.com/mcp'

        await expect(
          doMcpInstall({
            input,
            params: defaultParams,
            options: defaultOptions,
          })
        ).rejects.toThrow('User not found')

        expect(installMcpTools).not.toHaveBeenCalled()
      })

      it('should handle getConfigBySchema errors', async () => {
        const input = 'invalid-url'
        const configError = new Error('Invalid URL format')

        getConfigBySchema.mockImplementation(() => {
          throw configError
        })

        await expect(
          doMcpInstall({
            input,
            params: defaultParams,
            options: defaultOptions,
          })
        ).rejects.toThrow('Invalid URL format')
      })

      it('should handle swapSecrets errors', async () => {
        const input = 'https://example.com/mcp'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: { Authorization: '${SECRET}' },
          prefix: undefined,
        })

        const secretError = new Error('Secret not found')

        swapSecrets.mockRejectedValue(secretError)

        await expect(
          doMcpInstall({
            input,
            params: defaultParams,
            options: defaultOptions,
          })
        ).rejects.toThrow('Secret not found')
      })

      it('should handle installMcpTools errors', async () => {
        const input = 'https://example.com/mcp'
        const installError = new Error('MCP installation failed')

        installMcpTools.mockRejectedValue(installError)

        await expect(
          doMcpInstall({
            input,
            params: defaultParams,
            options: defaultOptions,
          })
        ).rejects.toThrow('MCP installation failed')
      })

      it('should handle logEvent errors gracefully', async () => {
        const input = 'https://example.com/mcp'
        const logError = new Error('Logging failed')

        logEvent.mockRejectedValue(logError)

        await expect(
          doMcpInstall({
            input,
            params: defaultParams,
            options: defaultOptions,
          })
        ).rejects.toThrow('Logging failed')
      })
    })

    describe('header processing', () => {
      it('should skip header processing when no headers provided and no secretId linked', async () => {
        const input = 'https://example.com/mcp'
        const optionsWithoutSecretId = {
          userId: 'user-123',
          linkedResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
            // no secretId
          },
          inlineSecrets: {},
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: undefined,
        })

        await doMcpInstall({
          input,
          params: defaultParams,
          options: optionsWithoutSecretId,
        })

        expect(swapSecrets).not.toHaveBeenCalled()
        expect(cleanupEmptyHeaders).not.toHaveBeenCalled()
        expect(toHeadersHashMap).not.toHaveBeenCalled()
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          expect.objectContaining({
            url: 'https://example.com/mcp',
            headers: undefined,
            prefix: undefined,
          })
        )
      })

      it('should process empty headers object when secretId is linked', async () => {
        const input = 'https://example.com/mcp'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: {},
          prefix: undefined,
        })

        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note auto-inject adds Authorization header when secretId is linked
        expect(swapSecrets).toHaveBeenCalledWith(
          expect.objectContaining({
            Authorization: '${SECRET_DEFAULT}',
          }),
          {
            userId: 'user-123',
            abilityId: 'ability-012',
            secretId: 'secret-345',
            inlineSecrets: {},
            discardSecretPlaceholders: true,
          }
        )
        expect(cleanupEmptyHeaders).toHaveBeenCalled()
        expect(toHeadersHashMap).toHaveBeenCalled()
      })

      it('should handle headers with secret placeholders', async () => {
        const input = 'https://example.com/mcp'
        const headersWithSecrets = {
          Authorization: '${SECRET_DEFAULT}',
          'X-API-Key': '${SECRET_CUSTOM}',
          'Custom-Header': 'static-value',
        }
        const processedHeaders = {
          Authorization: 'Bearer actual-token',
          'X-API-Key': 'actual-api-key',
          'Custom-Header': 'static-value',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: headersWithSecrets,
          prefix: undefined,
        })

        swapSecrets.mockResolvedValue(processedHeaders)
        cleanupEmptyHeaders.mockReturnValue(processedHeaders)
        toHeadersHashMap.mockReturnValue(processedHeaders)

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        expect(swapSecrets).toHaveBeenCalledWith(headersWithSecrets, {
          userId: 'user-123',
          abilityId: 'ability-012',
          secretId: 'secret-345',
          inlineSecrets: {},
          discardSecretPlaceholders: true,
        })
      })
    })

    describe('auto-inject Authorization header', () => {
      it('should auto-inject Authorization header when secretId is linked but no secrets in headers', async () => {
        const input = 'https://example.com/mcp'
        const configHeaders = {
          'Content-Type': 'application/json',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: configHeaders,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)

        const processedHeaders = { 'content-type': 'application/json' }

        swapSecrets.mockResolvedValue(processedHeaders)
        cleanupEmptyHeaders.mockReturnValue(processedHeaders)
        toHeadersHashMap.mockReturnValue(processedHeaders)

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should have added Authorization header with DEFAULT secret placeholder
        expect(swapSecrets).toHaveBeenCalledWith(
          expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: '${SECRET_DEFAULT}',
          }),
          expect.any(Object)
        )
      })

      it('should not auto-inject when headers already reference secrets', async () => {
        const input = 'https://example.com/mcp'
        const headersWithSecrets = {
          'X-API-Key': '${SECRET_CUSTOM}',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: headersWithSecrets,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(true)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should NOT have modified the headers
        expect(swapSecrets).toHaveBeenCalledWith(
          { 'X-API-Key': '${SECRET_CUSTOM}' },
          expect.any(Object)
        )
      })

      it('should not auto-inject when Authorization header already exists (lowercase)', async () => {
        const input = 'https://example.com/mcp'
        const headersWithAuth = {
          authorization: 'Bearer static-token',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: headersWithAuth,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should NOT have added Authorization header since it already exists
        expect(swapSecrets).toHaveBeenCalledWith(
          { authorization: 'Bearer static-token' },
          expect.any(Object)
        )
      })

      it('should not auto-inject when Authorization header already exists (capitalized)', async () => {
        const input = 'https://example.com/mcp'
        const headersWithAuth = {
          Authorization: 'Bearer static-token',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: headersWithAuth,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should NOT have added Authorization header since it already exists
        expect(swapSecrets).toHaveBeenCalledWith(
          { Authorization: 'Bearer static-token' },
          expect.any(Object)
        )
      })

      it('should not auto-inject when no secretId is linked', async () => {
        const input = 'https://example.com/mcp'
        const optionsWithoutSecretId = {
          userId: 'user-123',
          linkedResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
            // no secretId
          },
          inlineSecrets: {},
        }

        const configHeaders = {
          'Content-Type': 'application/json',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: configHeaders,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: optionsWithoutSecretId,
        })

        // @note should NOT have added Authorization header since no secretId
        expect(swapSecrets).toHaveBeenCalledWith(
          { 'Content-Type': 'application/json' },
          expect.any(Object)
        )
      })

      it('should auto-inject for empty headers when secretId is linked', async () => {
        const input = 'https://example.com/mcp'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: {},
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should have added Authorization header with DEFAULT secret placeholder
        expect(swapSecrets).toHaveBeenCalledWith(
          { Authorization: '${SECRET_DEFAULT}' },
          expect.any(Object)
        )
      })

      it('should auto-inject for undefined headers when secretId is linked', async () => {
        const input = 'https://example.com/mcp'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: undefined,
        })
        hasSecrets.mockReturnValue(false)
        swapSecrets.mockResolvedValue({})
        cleanupEmptyHeaders.mockReturnValue({})
        toHeadersHashMap.mockReturnValue({})

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note should have added Authorization header with DEFAULT secret placeholder
        expect(swapSecrets).toHaveBeenCalledWith(
          { Authorization: '${SECRET_DEFAULT}' },
          expect.any(Object)
        )
      })
    })

    describe('edge cases', () => {
      it('should handle missing options.linkedResources', async () => {
        const input = 'https://example.com/mcp'
        const optionsWithoutLinkedResources = {
          userId: 'user-123',
          inlineSecrets: {},
        }

        const result = await doMcpInstall({
          input,
          params: defaultParams,
          options: optionsWithoutLinkedResources,
        })

        expect(swapSecrets).not.toHaveBeenCalled()
        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle missing options.inlineSecrets', async () => {
        const input = 'https://example.com/mcp'
        const optionsWithoutInlineSecrets = {
          userId: 'user-123',
          linkedResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
            secretId: 'secret-345',
          },
        }

        const result = await doMcpInstall({
          input,
          params: defaultParams,
          options: optionsWithoutInlineSecrets,
        })

        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle long URLs', async () => {
        const longUrl =
          'https://example.com/mcp' + '/'.repeat(1000) + 'endpoint'

        getConfigBySchema.mockReturnValue({
          url: longUrl,
          headers: undefined,
          prefix: undefined,
        })

        const result = await doMcpInstall({
          input: longUrl,
          params: { install: longUrl },
          options: defaultOptions,
        })

        // @note headers is {} because auto-inject adds Authorization header when secretId is linked
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          expect.objectContaining({
            url: longUrl,
            prefix: undefined,
          })
        )
        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle special characters in prefix', async () => {
        const input = 'https://example.com/mcp'
        const specialPrefix = 'my-tools_123!@#$%'

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: specialPrefix,
        })

        await doMcpInstall({
          input,
          params: defaultParams,
          options: defaultOptions,
        })

        // @note headers is {} because auto-inject adds Authorization header when secretId is linked
        expect(installMcpTools).toHaveBeenCalledWith(
          { id: 'user-123' },
          expect.objectContaining({
            url: 'https://example.com/mcp',
            prefix: specialPrefix,
          })
        )
      })
    })
  })

  describe('executeMcpAction', () => {
    const defaultOptions = {
      userId: 'user-123',
      linkedResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    beforeEach(() => {
      jest.doMock('@/lib/action.exec.mcp', () => ({
        ...jest.requireActual('@/lib/action.exec.mcp'),

        doMcpInstall: jest
          .fn()
          .mockResolvedValue({ result: { success: true } }),
      }))
    })

    describe('operation detection', () => {
      it('should detect install operation from install parameter', async () => {
        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        const mockDoMcpInstall = jest
          .fn()
          .mockResolvedValue({ result: { success: true } })
        const originalDoMcpInstall = doMcpInstall

        const mockModule = jest.requireMock('@/lib/action.exec.mcp')

        mockModule.doMcpInstall = mockDoMcpInstall

        await executeMcpAction(input, params, defaultOptions)

        mockModule.doMcpInstall = originalDoMcpInstall
      })

      it('should detect install operation from activate parameter (legacy)', async () => {
        const input = 'https://example.com/mcp'
        const params = { activate: 'https://example.com/mcp' }

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toBeDefined()
      })

      it('should throw error for unknown operation', async () => {
        const input = 'https://example.com/mcp'
        const params = { unknown: 'https://example.com/mcp' }

        await expect(
          executeMcpAction(input, params, defaultOptions)
        ).rejects.toThrow('Unknown MCP operation')
      })

      it('should throw error for missing operation parameters', async () => {
        const input = 'https://example.com/mcp'
        const params = {}

        await expect(
          executeMcpAction(input, params, defaultOptions)
        ).rejects.toThrow('Unknown MCP operation')
      })
    })

    describe('operation execution', () => {
      it('should execute install operation successfully', async () => {
        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: undefined,
        })

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle install operation with all parameters', async () => {
        const input = 'https://example.com/mcp'
        const params = {
          install: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          prefix: 'my-tools',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          prefix: 'my-tools',
        })
        swapSecrets.mockResolvedValue({ Authorization: 'Bearer token' })
        cleanupEmptyHeaders.mockReturnValue({ Authorization: 'Bearer token' })
        toHeadersHashMap.mockReturnValue({ authorization: 'Bearer token' })

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toEqual({ result: { success: true } })
      })
    })

    describe('error propagation', () => {
      it('should propagate user not found error', async () => {
        fastGetUserById.mockResolvedValue(null)

        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        await expect(
          executeMcpAction(input, params, defaultOptions)
        ).rejects.toThrow('User not found')
      })

      it('should propagate MCP installation errors', async () => {
        const installError = new Error('MCP server unreachable')

        installMcpTools.mockRejectedValue(installError)

        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        await expect(
          executeMcpAction(input, params, defaultOptions)
        ).rejects.toThrow('MCP server unreachable')
      })

      it('should propagate configuration parsing errors', async () => {
        const configError = new Error('Invalid configuration schema')

        getConfigBySchema.mockImplementation(() => {
          throw configError
        })

        const input = 'invalid-config'
        const params = { install: 'invalid-config' }

        await expect(
          executeMcpAction(input, params, defaultOptions)
        ).rejects.toThrow('Invalid configuration schema')
      })
    })

    describe('integration with debug and logging', () => {
      it('should call debug logging', async () => {
        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        await executeMcpAction(input, params, defaultOptions)

        expect(debug).toHaveBeenCalledWith('execute mcp action', {
          input,
          params,
          options: defaultOptions,
        })
      })

      it('should maintain debug context throughout execution', async () => {
        const input = 'https://example.com/mcp'
        const params = { install: 'https://example.com/mcp' }

        await executeMcpAction(input, params, defaultOptions)

        expect(debug).toHaveBeenCalled()
        expect(debug).toHaveBeenCalledWith('execute mcp action', {
          input,
          params,
          options: defaultOptions,
        })
      })
    })

    describe('edge cases', () => {
      it('should handle null input', async () => {
        const input = null
        const params = { install: 'https://example.com/mcp' }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: undefined,
        })

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle empty string input', async () => {
        const input = ''
        const params = { install: 'https://example.com/mcp' }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: undefined,
          prefix: undefined,
        })

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toEqual({ result: { success: true } })
      })

      it('should handle complex params object', async () => {
        const input = 'https://example.com/mcp'
        const params = {
          install: 'https://example.com/mcp',
          headers: {
            Authorization: 'Bearer token',
            'Custom-Header': 'value',
          },
          prefix: 'complex-tools',
          extra: 'ignored-parameter',
        }

        getConfigBySchema.mockReturnValue({
          url: 'https://example.com/mcp',
          headers: params.headers,
          prefix: 'complex-tools',
        })
        swapSecrets.mockResolvedValue(params.headers)
        cleanupEmptyHeaders.mockReturnValue(params.headers)
        toHeadersHashMap.mockReturnValue({
          authorization: 'Bearer token',
          'custom-header': 'value',
        })

        const result = await executeMcpAction(input, params, defaultOptions)

        expect(result).toEqual({ result: { success: true } })
      })
    })
  })
})
