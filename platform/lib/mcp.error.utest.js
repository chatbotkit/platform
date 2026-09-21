import { FetchError } from '@/lib/fetch'
import { rethrowMcpError } from '@/lib/mcp.error'
import { isUnknownError } from '@/lib/response'

import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { McpError } from '@modelcontextprotocol/sdk/types.js'

describe('mcp.error', () => {
  describe('rethrowMcpError', () => {
    it('should convert McpError to FetchError', () => {
      const mcpError = new McpError(-32603, 'internal error', { foo: 'bar' })

      expect(() => rethrowMcpError(mcpError)).toThrow(FetchError)
    })

    it('should preserve full message from McpError including code prefix', () => {
      const mcpError = new McpError(
        -32603,
        'error calling original endpoint for rank-tracker/overview: 400'
      )

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        // @note McpError constructor formats message as "MCP error <code>: <message>"
        expect(e.message).toBe(
          'MCP error -32603: error calling original endpoint for rank-tracker/overview: 400'
        )
      }
    })

    it('should set error code as string from MCP code', () => {
      const mcpError = new McpError(-32603, 'internal error')

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.code).toBe('-32603')
      }
    })

    it('should surface McpError data (e.g. timeout) as FetchError meta', () => {
      const mcpError = new McpError(-32001, 'Request timed out', {
        timeout: 60000,
      })

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        // @note FetchError encodes meta into its name so the timeout value is
        // visible in logs, distinguishing connect (30000) vs request (60000)
        // timeouts from remote-relayed errors that have no data
        expect(e.name).toBe('FetchError({"timeout":60000})')
      }
    })

    it('should treat an McpError request timeout as an expected error', () => {
      expect.assertions(3)

      const mcpError = new McpError(-32001, 'Request timed out', {
        timeout: 60000,
      })

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.code).toBe('-32001')
        expect(isUnknownError(e)).toBe(false)
      }
    })

    it('should not attach meta when McpError has no data', () => {
      const mcpError = new McpError(-32001, 'Request timed out')

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.name).toBe('FetchError')
      }
    })

    it('should convert StreamableHTTPError to FetchError with the status code mapped', () => {
      const error = new StreamableHTTPError(
        403,
        'Error POSTing to endpoint: forbidden'
      )

      try {
        rethrowMcpError(error)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.message).toBe(
          'Streamable HTTP error: Error POSTing to endpoint: forbidden'
        )
        expect(e.code).toBe('NOT_AUTHORIZED')
        expect(e.name).toBe('FetchError({"status":403})')
      }
    })

    it('should map a 5xx StreamableHTTPError to its gateway code', () => {
      const error = new StreamableHTTPError(
        502,
        'Error POSTing to endpoint: Container suddenly disconnected, try again'
      )

      try {
        rethrowMcpError(error)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.code).toBe('BAD_GATEWAY')
      }
    })

    it('should keep an unmapped StreamableHTTPError status as the code', () => {
      const error = new StreamableHTTPError(
        418,
        'Error POSTing to endpoint: teapot'
      )

      try {
        rethrowMcpError(error)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.code).toBe('418')
      }
    })

    it('should rethrow non-McpError as-is', () => {
      const regularError = new Error('regular error')

      expect(() => rethrowMcpError(regularError)).toThrow(regularError)
    })

    it('should rethrow FetchError as-is', () => {
      const fetchError = new FetchError('fetch error', 'FETCH_ERROR')

      expect(() => rethrowMcpError(fetchError)).toThrow(fetchError)
    })

    it('should rethrow string errors as-is', () => {
      expect(() => rethrowMcpError('string error')).toThrow('string error')
    })

    it('should rethrow null/undefined as-is', () => {
      expect(() => rethrowMcpError(null)).toThrow()
      expect(() => rethrowMcpError(undefined)).toThrow()
    })
  })
})
