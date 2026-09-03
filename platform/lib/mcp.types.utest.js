describe('mcp.types', () => {
  describe('type definitions', () => {
    it('should define McpInstallOptions interface', () => {
      const options = {
        sessionId: 'test-session-id',
        url: 'https://example.com/mcp',
        headers: { 'Content-Type': 'application/json' },
        tools: ['tool1', 'tool2'],
        prefix: 'mcp',
      }

      expect(options.sessionId).toBe('test-session-id')
      expect(options.url).toBe('https://example.com/mcp')
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(options.tools).toEqual(['tool1', 'tool2'])
      expect(options.prefix).toBe('mcp')
    })

    it('should define McpInstallOptions interface with optional fields', () => {
      const options = {
        sessionId: 'test-session-id',
        url: 'https://example.com/mcp',
      }

      expect(options.sessionId).toBe('test-session-id')
      expect(options.url).toBe('https://example.com/mcp')
      expect(options.headers).toBeUndefined()
      expect(options.tools).toBeUndefined()
      expect(options.prefix).toBeUndefined()
    })

    it('should define McpInstallRequest interface', () => {
      const request = {
        sessionId: 'test-session-id',
        url: 'https://example.com/mcp',
        conversationId: 'conv-123',
        contactId: 'contact-456',
        namespace: 'test-namespace',
        headers: { Authorization: 'Bearer token' },
        tools: ['tool1'],
        prefix: 'test',
      }

      expect(request.sessionId).toBe('test-session-id')
      expect(request.url).toBe('https://example.com/mcp')
      expect(request.conversationId).toBe('conv-123')
      expect(request.contactId).toBe('contact-456')
      expect(request.namespace).toBe('test-namespace')
    })

    it('should define McpInstallRequest interface with minimal fields', () => {
      const request = {
        sessionId: 'test-session-id',
        url: 'https://example.com/mcp',
      }

      expect(request.sessionId).toBe('test-session-id')
      expect(request.url).toBe('https://example.com/mcp')
      expect(request.conversationId).toBeUndefined()
      expect(request.contactId).toBeUndefined()
      expect(request.namespace).toBeUndefined()
    })

    it('should define McpInstallResponse interface', () => {
      const response = {
        success: true,
      }

      expect(response.success).toBe(true)
    })

    it('should define McpInstallResponse interface with failure', () => {
      const response = {
        success: false,
      }

      expect(response.success).toBe(false)
    })

    it('should define McpCallRequest interface', () => {
      const request = {
        conversationId: 'conv-123',
        contactId: 'contact-456',
        namespace: 'test-namespace',
        tool: {
          name: 'test-tool',
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
            },
          },
        },
        args: { param1: 'value1' },
      }

      expect(request.conversationId).toBe('conv-123')
      expect(request.contactId).toBe('contact-456')
      expect(request.namespace).toBe('test-namespace')
      expect(request.tool.name).toBe('test-tool')
      expect(request.args).toEqual({ param1: 'value1' })
    })

    it('should define McpCallRequest interface with minimal fields', () => {
      const request = {
        tool: {
          name: 'minimal-tool',
          description: 'Minimal tool',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
        args: {},
      }

      expect(request.conversationId).toBeUndefined()
      expect(request.contactId).toBeUndefined()
      expect(request.namespace).toBeUndefined()
      expect(request.tool.name).toBe('minimal-tool')
      expect(request.args).toEqual({})
    })

    it('should allow unknown args type in McpCallRequest', () => {
      const request = {
        tool: {
          name: 'test-tool',
          description: 'Test',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
        args: null,
      }

      expect(request.args).toBeNull()
    })

    it('should allow complex args in McpCallRequest', () => {
      const complexArgs = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
        null: null,
        bool: true,
      }

      const request = {
        tool: {
          name: 'test-tool',
          description: 'Test',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
        args: complexArgs,
      }

      expect(request.args).toEqual(complexArgs)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      const options = {
        sessionId: '',
        url: '',
        prefix: '',
      }

      expect(options.sessionId).toBe('')
      expect(options.url).toBe('')
      expect(options.prefix).toBe('')
    })

    it('should handle empty arrays', () => {
      const options = {
        sessionId: 'test',
        url: 'https://example.com',
        tools: [],
      }

      expect(options.tools).toEqual([])
    })

    it('should handle empty objects', () => {
      const options = {
        sessionId: 'test',
        url: 'https://example.com',
        headers: {},
      }

      expect(options.headers).toEqual({})
    })
  })
})
