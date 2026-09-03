import { FetchError } from '@/lib/fetch'
import { rethrowMcpError } from '@/lib/mcp.error'

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

    it('should not attach meta when McpError has no data', () => {
      const mcpError = new McpError(-32001, 'Request timed out')

      try {
        rethrowMcpError(mcpError)
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError)
        expect(e.name).toBe('FetchError')
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
