/**
 * @jest-environment node
 */
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import {
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import { callMcpTool } from '@/lib/mcp.edge'
import memcache from '@/lib/memcache'
import { canUseSkillset } from '@/lib/skillset.access'
import { applySkillset } from '@/lib/skillset.apply'

import {
  getEnvironmentKey,
  getEnvironmentTools,
  installEnvironmentTools,
  makeEnvironmentToolSource,
} from './tool.environment'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    skillset: {
      findUnique: jest.fn(),
    },
    ability: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    setFieldWithExpiry: jest.fn(async () => undefined),
    hgetall: jest.fn(),
    hdel: jest.fn(),
    del: jest.fn(),
  },
}))

jest.mock('@/lib/context.store', () => ({
  getContextConversation: jest.fn(),
  getContextNamespace: jest.fn(),
}))

jest.mock('@/lib/mcp.edge', () => ({
  callMcpTool: jest.fn(),
}))

jest.mock('@/lib/skillset.access', () => ({
  canUseSkillset: jest.fn(),
}))

jest.mock('@/lib/skillset.apply', () => ({
  applySkillset: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthorized: jest.fn((msg) => {
    throw new Error(msg)
  }),
  throwNotFound: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('makeEnvironmentToolSource', () => {
  it('should build a key from kind and id', () => {
    expect(makeEnvironmentToolSource('skillset', 'skillset-123')).toBe(
      'skillset:skillset-123'
    )
  })

  it('should include the prefix when provided', () => {
    expect(makeEnvironmentToolSource('mcp', 'https://example.com', 'gh')).toBe(
      'mcp:https://example.com:gh'
    )
  })

  it('should omit an empty prefix', () => {
    expect(makeEnvironmentToolSource('pack', 'ability-1', '')).toBe(
      'pack:ability-1'
    )
  })

  it('should give the same source for the same triple and different for a different prefix', () => {
    expect(makeEnvironmentToolSource('skillset', 'a')).toBe(
      makeEnvironmentToolSource('skillset', 'a')
    )
    expect(makeEnvironmentToolSource('skillset', 'a', 'p1')).not.toBe(
      makeEnvironmentToolSource('skillset', 'a', 'p2')
    )
  })
})

describe('getEnvironmentKey', () => {
  describe('conversation context', () => {
    it('should generate key for conversation context', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })
      getContextNamespace.mockReturnValue(null)

      const key = await getEnvironmentKey()

      expect(key).toBe('tool:environment:v2:conversation-conv-123')
    })

    it('should prioritize conversation over namespace', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-456' })
      getContextNamespace.mockReturnValue('namespace-789')

      const key = await getEnvironmentKey()

      expect(key).toBe('tool:environment:v2:conversation-conv-456')
    })
  })

  describe('namespace context', () => {
    it('should generate key for namespace context', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue('namespace-123')

      const key = await getEnvironmentKey()

      expect(key).toBe('tool:environment:v2:namespace-namespace-123')
    })

    it('should handle string namespace', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue('custom-namespace')

      const key = await getEnvironmentKey()

      expect(key).toBe('tool:environment:v2:namespace-custom-namespace')
    })
  })

  describe('no context', () => {
    it('should return null when no context is available', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue(null)

      const key = await getEnvironmentKey()

      expect(key).toBeNull()
    })

    it('should return null when context returns undefined', async () => {
      getContextConversation.mockReturnValue(undefined)
      getContextNamespace.mockReturnValue(undefined)

      const key = await getEnvironmentKey()

      expect(key).toBeNull()
    })
  })
})

describe('installEnvironmentTools', () => {
  // @note the EVAL script that writes a hash field and refreshes the TTL
  describe('successful installation', () => {
    it('should install tools under their source field with conversation context', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })
      getContextNamespace.mockReturnValue(null)

      const tools = [
        {
          handler: 'ability',
          name: 'test-tool',
          description: 'Test tool',
          source: 'skillset:skillset-123',
          inputSchema: { type: 'object' },
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const result = await installEnvironmentTools(tools)

      expect(result).toBe(true)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledTimes(1)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:conversation-conv-123',
        'source:skillset:skillset-123',
        tools,
        ONE_HOUR_IN_SECONDS
      )
    })

    it('should install tools with namespace context', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue('namespace-456')

      const tools = [
        {
          handler: 'mcp',
          name: 'mcp-tool',
          description: 'MCP tool',
          source: 'mcp:https://example.com',
          inputSchema: { type: 'object' },
          options: {
            userId: 'user-123',
            sessionId: 'session-123',
            url: 'https://example.com',
            toolName: 'test',
          },
        },
      ]

      const result = await installEnvironmentTools(tools)

      expect(result).toBe(true)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:namespace-namespace-456',
        'source:mcp:https://example.com',
        tools,
        ONE_HOUR_IN_SECONDS
      )
    })

    it('should write one independent field per source for a mixed batch', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-789' })

      const toolA = {
        handler: 'ability',
        name: 'tool1',
        source: 'skillset:s1',
        inputSchema: {},
        options: { userId: 'user-1', skillsetId: 's1', abilityId: 'a1' },
      }

      const toolB = {
        handler: 'mcp',
        name: 'tool2',
        source: 'mcp:https://example.com',
        inputSchema: {},
        options: {
          userId: 'user-1',
          sessionId: 'sess-1',
          url: 'https://example.com',
          toolName: 'tool2',
        },
      }

      const result = await installEnvironmentTools([toolA, toolB])

      expect(result).toBe(true)
      // @note two distinct sources -> two independent field writes
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledTimes(2)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:conversation-conv-789',
        'source:skillset:s1',
        [toolA],
        ONE_HOUR_IN_SECONDS
      )
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:conversation-conv-789',
        'source:mcp:https://example.com',
        [toolB],
        ONE_HOUR_IN_SECONDS
      )
    })

    it('should group tools that share a source into a single field write', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-1' })

      const source = 'pack:ability-1'

      const toolA = {
        handler: 'ability-template',
        name: 'a',
        source,
        inputSchema: {},
        options: { userId: 'u', instruction: '@x' },
      }

      const toolB = {
        handler: 'ability-template',
        name: 'b',
        source,
        inputSchema: {},
        options: { userId: 'u', instruction: '@y' },
      }

      const result = await installEnvironmentTools([toolA, toolB])

      expect(result).toBe(true)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledTimes(1)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:conversation-conv-1',
        'source:pack:ability-1',
        [toolA, toolB],
        ONE_HOUR_IN_SECONDS
      )
    })

    it('should fall back to a per-name field for tools without a source', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-1' })

      const tool = {
        handler: 'ability-template',
        name: 'legacy_tool',
        inputSchema: {},
        options: { userId: 'u', instruction: '@x' },
      }

      const result = await installEnvironmentTools([tool])

      expect(result).toBe(true)
      expect(memcache.setFieldWithExpiry).toHaveBeenCalledWith(
        'tool:environment:v2:conversation-conv-1',
        'name:legacy_tool',
        [tool],
        ONE_HOUR_IN_SECONDS
      )
    })

    it('should be a no-op for an empty tools array', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const result = await installEnvironmentTools([])

      expect(result).toBe(true)
      expect(memcache.setFieldWithExpiry).not.toHaveBeenCalled()
    })
  })

  describe('concurrency safety (regression for the parallel-install clobber)', () => {
    it('two installs of different sources write disjoint fields and do not clobber each other', async () => {
      // @note this is the exact shape of the reported bug: the model emitted
      // install_space_storage_tools and install_space_skills_tools in one turn.
      // They execute in parallel; each must land in its own hash field so
      // neither overwrites the other. The old JS get-merge-set let both reads
      // observe the same baseline and the last set won, dropping a whole pack.
      getContextConversation.mockReturnValue({ id: 'conv-x' })
      getContextNamespace.mockReturnValue(null)

      const storageTools = [
        {
          handler: 'ability-template',
          name: 'write_space_storage_file',
          source: 'pack:storage-ability',
          inputSchema: {},
          options: { userId: 'u', instruction: '@pack/cbk/space/storage' },
        },
      ]

      const skillsTools = [
        {
          handler: 'ability-template',
          name: 'list_space_skills',
          source: 'pack:skills-ability',
          inputSchema: {},
          options: { userId: 'u', instruction: '@pack/cbk/space/skills' },
        },
      ]

      await Promise.all([
        installEnvironmentTools(storageTools),
        installEnvironmentTools(skillsTools),
      ])

      const fieldsWritten = memcache.setFieldWithExpiry.mock.calls.map(
        (call) => call[1]
      )

      expect(fieldsWritten).toEqual(
        expect.arrayContaining([
          'source:pack:storage-ability',
          'source:pack:skills-ability',
        ])
      )
      // @note the two installs must target two different fields
      expect(new Set(fieldsWritten).size).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should return false when no context key is available', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue(null)

      const tools = [
        {
          handler: 'ability',
          name: 'test',
          source: 'skillset:skillset-123',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const result = await installEnvironmentTools(tools)

      expect(result).toBe(false)
      expect(memcache.setFieldWithExpiry).not.toHaveBeenCalled()
    })

    it('should propagate redis errors', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const tools = [
        {
          handler: 'ability',
          name: 'test',
          source: 'skillset:skillset-123',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      memcache.setFieldWithExpiry.mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      await expect(installEnvironmentTools(tools)).rejects.toThrow(
        'Redis connection failed'
      )
    })
  })
})

describe('getEnvironmentTools', () => {
  describe('successful retrieval', () => {
    it('should retrieve and convert ability tools', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })
      getContextNamespace.mockReturnValue(null)

      const storedTools = [
        {
          handler: 'ability',
          name: 'test-ability',
          description: 'Test ability tool',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('test-ability')
      expect(tools[0].description).toBe('Test ability tool')
      expect(tools[0].inputSchema).toEqual({ type: 'object' })
      expect(tools[0].outputSchema).toEqual({ type: 'object' })
      expect(typeof tools[0].handler).toBe('function')
    })

    it('should retrieve and convert mcp tools', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue('namespace-123')

      const storedTools = [
        {
          handler: 'mcp',
          name: 'test-mcp',
          description: 'Test MCP tool',
          inputSchema: { type: 'object' },
          options: {
            userId: 'user-456',
            sessionId: 'session-456',
            url: 'https://mcp.example.com',
            toolName: 'test',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('test-mcp')
      expect(tools[0].description).toBe('Test MCP tool')
      expect(typeof tools[0].handler).toBe('function')
    })

    it('should retrieve multiple tools', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'tool1',
          inputSchema: {},
          options: {
            userId: 'user-1',
            skillsetId: 'skillset-1',
            abilityId: 'ability-1',
          },
        },
        {
          handler: 'mcp',
          name: 'tool2',
          inputSchema: {},
          options: {
            userId: 'user-1',
            sessionId: 'session-1',
            url: 'https://example.com',
            toolName: 'tool2',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools).toHaveLength(2)
      expect(tools[0].name).toBe('tool1')
      expect(tools[1].name).toBe('tool2')
    })
  })

  describe('no tools scenarios', () => {
    it('should return empty array when no context key', async () => {
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue(null)

      const tools = await getEnvironmentTools()

      expect(tools).toEqual([])
      expect(memcache.hgetall).not.toHaveBeenCalled()
    })

    it('should return empty array when no tools stored', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      memcache.hgetall.mockResolvedValue(null)

      const tools = await getEnvironmentTools()

      expect(tools).toEqual([])
    })

    it('should return empty array when redis returns undefined', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      memcache.hgetall.mockResolvedValue(undefined)

      const tools = await getEnvironmentTools()

      expect(tools).toEqual([])
    })

    it('should handle empty tools array from redis', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      memcache.hgetall.mockResolvedValue({})

      const tools = await getEnvironmentTools()

      expect(tools).toEqual([])
    })
  })

  describe('ability tool handler execution', () => {
    it('should execute ability tool successfully', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'calculator',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [
          {
            id: 'ability-123',
            name: 'calculator',
            instruction: '```text\nCompute ${!expression}\n```',
            meta: null,
          },
        ],
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      applySkillset.mockResolvedValue({
        error: null,
        result: { answer: 42 },
      })

      const tools = await getEnvironmentTools()
      const result = await tools[0].handler({ expression: '6*7' })

      expect(prisma.skillset.findUnique).toHaveBeenCalledWith({
        where: { id: 'skillset-123' },
        include: { abilities: true },
      })
      expect(canUseSkillset).toHaveBeenCalledWith('user-123', mockSkillset)
      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        mockSkillset,
        'calculator',
        '{"expression":"6*7"}'
      )
      expect(result).toEqual({
        error: null,
        result: { answer: 42 },
      })
    })

    it('should pass flat object input for ability tools before applySkillset', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'list-buffer-channels',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [
          {
            id: 'ability-123',
            name: 'list-buffer-channels',
            instruction: `!fetch
method: POST
url: https://api.buffer.com
body:
  variables:
    organizationId: !string
      name: organizationId
      optional: false`,
            meta: null,
          },
        ],
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      applySkillset.mockResolvedValue({
        error: null,
        result: 'success',
      })

      const tools = await getEnvironmentTools()

      await tools[0].handler({ organizationId: '66e1960459bcf53793d87a33' })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        mockSkillset,
        'list-buffer-channels',
        '{"organizationId":"66e1960459bcf53793d87a33"}'
      )
    })

    it('should throw error when skillset not found', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'test',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'nonexistent',
            abilityId: 'ability-123',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(null)

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow('Skillset not found')
    })

    it('should throw error when user not authorized', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'test',
          inputSchema: {},
          options: {
            userId: 'user-456',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [{ id: 'ability-123', name: 'test' }],
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(false)

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow(
        'Not authorized to use skillset'
      )
    })

    it('should throw error when ability not found in skillset', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'test',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'nonexistent-ability',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [{ id: 'ability-123', name: 'other' }],
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow(
        'Ability not found in skillset'
      )
    })

    it('should return error from applySkillset', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'test',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [{ id: 'ability-123', name: 'test' }],
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      applySkillset.mockResolvedValue({
        error: 'Invalid input',
        result: null,
      })

      const tools = await getEnvironmentTools()
      const result = await tools[0].handler({ input: 'bad' })

      expect(result).toEqual({
        error: 'Invalid input',
        result: null,
      })
    })

    it('should handle complex arguments', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'test',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      const mockSkillset = {
        id: 'skillset-123',
        userId: 'user-123',
        abilities: [
          {
            id: 'ability-123',
            name: 'test',
            instruction: `!fetch
method: POST
url: /api/test
body:
  nested: !object
    name: nested
    properties:
      value:
        type: string
  array: !array
    name: array
    items:
      type: number
  boolean: !boolean
    name: boolean`,
            meta: null,
          },
        ],
      }

      const complexArgs = {
        nested: { value: 'test' },
        array: [1, 2, 3],
        boolean: true,
      }

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.skillset.findUnique.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      applySkillset.mockResolvedValue({
        error: null,
        result: 'success',
      })

      const tools = await getEnvironmentTools()

      await tools[0].handler(complexArgs)

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        mockSkillset,
        'test',
        JSON.stringify(complexArgs)
      )
    })
  })

  describe('ability template tool handler execution', () => {
    it('should pass flat object input for ability-template tools before applySkillset', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability-template',
          name: 'pack-template-list_buffer_channels',
          inputSchema: {},
          options: {
            userId: 'user-123',
            instruction: '@buffer/channel/list',
            linkedResources: {
              secretId: 'secret-123',
            },
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      applySkillset.mockResolvedValue({
        error: null,
        result: 'success',
      })

      const tools = await getEnvironmentTools()

      await tools[0].handler({ organizationId: '66e1960459bcf53793d87a33' })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          id: 'pack-template',
          abilities: [
            expect.objectContaining({
              id: 'pack-template-pack-template-list_buffer_channels',
              name: 'pack-template-list_buffer_channels',
              instruction: '@buffer/channel/list',
              // linked resources land on the renamed ability link keys
              linkedSecretId: 'secret-123',
              linkedFileId: null,
              linkedBotId: null,
              linkedSpaceId: null,
            }),
          ],
        }),
        'pack-template-list_buffer_channels',
        '{"organizationId":"66e1960459bcf53793d87a33"}'
      )
    })
    it('should re-read linked resources from the installing ability at call time', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability-template',
          name: 'pack-template-execute_shell_command',
          inputSchema: {},
          options: {
            userId: 'user-123',
            instruction: '@shell/exec',
            abilityId: 'ability-123',
            // the snapshot taken at install time predates the space link
            linkedResources: {},
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.ability.findUnique.mockResolvedValue({
        linkedSecretId: null,
        linkedFileId: null,
        linkedBotId: null,
        linkedSpaceId: 'space-456',
      })
      applySkillset.mockResolvedValue({ error: null, result: 'ok' })

      const tools = await getEnvironmentTools()

      await tools[0].handler({ command: 'ls /space' })

      expect(prisma.ability.findUnique).toHaveBeenCalledWith({
        where: { id: 'ability-123' },
        select: {
          linkedSecretId: true,
          linkedFileId: true,
          linkedBotId: true,
          linkedSpaceId: true,
        },
      })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          abilities: [
            expect.objectContaining({
              linkedSpaceId: 'space-456',
              linkedSecretId: null,
            }),
          ],
        }),
        'pack-template-execute_shell_command',
        expect.any(String)
      )
    })

    it('should fall back to the install-time snapshot when the ability is gone', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability-template',
          name: 'pack-template-execute_shell_command',
          inputSchema: {},
          options: {
            userId: 'user-123',
            instruction: '@shell/exec',
            abilityId: 'ability-deleted',
            linkedResources: { spaceId: 'space-snapshot' },
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      prisma.ability.findUnique.mockResolvedValue(null)
      applySkillset.mockResolvedValue({ error: null, result: 'ok' })

      const tools = await getEnvironmentTools()

      await tools[0].handler({ command: 'ls /space' })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          abilities: [expect.objectContaining({ linkedSpaceId: 'space-snapshot' })],
        }),
        'pack-template-execute_shell_command',
        expect.any(String)
      )
    })

    it('should not query the ability when the tool carries no abilityId', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      memcache.hgetall.mockResolvedValue({
        tools: [
          {
            handler: 'ability-template',
            name: 'pack-template-inline',
            inputSchema: {},
            options: {
              userId: 'user-123',
              instruction: 'inline instruction',
              linkedResources: { spaceId: 'space-inline' },
            },
          },
        ],
      })
      applySkillset.mockResolvedValue({ error: null, result: 'ok' })

      const tools = await getEnvironmentTools()

      await tools[0].handler({})

      expect(prisma.ability.findUnique).not.toHaveBeenCalled()
      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          abilities: [expect.objectContaining({ linkedSpaceId: 'space-inline' })],
        }),
        'pack-template-inline',
        expect.any(String)
      )
    })
  })

  describe('mcp tool handler execution', () => {
    it('should execute mcp tool successfully', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'mcp',
          name: 'fetch-data',
          inputSchema: {},
          options: {
            userId: 'user-789',
            sessionId: 'session-789',
            url: 'https://mcp.example.com',
            headers: { 'X-Custom': 'header' },
            toolName: 'fetch',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      callMcpTool.mockResolvedValue({ data: 'result' })

      const tools = await getEnvironmentTools()
      const args = { query: 'test' }
      const result = await tools[0].handler(args)

      expect(callMcpTool).toHaveBeenCalledWith(
        { id: 'user-789' },
        storedTools[0],
        args
      )
      expect(result).toEqual({ data: 'result' })
    })

    it('should handle mcp tool errors', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'mcp',
          name: 'fetch-data',
          inputSchema: {},
          options: {
            userId: 'user-789',
            sessionId: 'session-789',
            url: 'https://mcp.example.com',
            toolName: 'fetch',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      callMcpTool.mockRejectedValue(new Error('MCP connection failed'))

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow(
        'MCP connection failed'
      )
    })

    it('should pass headers to mcp tool', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'mcp',
          name: 'auth-tool',
          inputSchema: {},
          options: {
            userId: 'user-789',
            sessionId: 'session-789',
            url: 'https://secure.example.com',
            headers: {
              Authorization: 'Bearer token123',
              'X-API-Key': 'key456',
            },
            toolName: 'auth',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })
      callMcpTool.mockResolvedValue({ success: true })

      const tools = await getEnvironmentTools()

      await tools[0].handler({ action: 'login' })

      expect(callMcpTool).toHaveBeenCalledWith(
        { id: 'user-789' },
        storedTools[0],
        { action: 'login' }
      )
    })
  })

  describe('unknown handler type', () => {
    it('should throw error for unknown handler type', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'unknown-handler',
          name: 'test',
          inputSchema: {},
          options: {},
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow('Not implemented')
    })

    it('should handle null handler gracefully', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: null,
          name: 'test',
          inputSchema: {},
          options: {},
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      await expect(tools[0].handler({})).rejects.toThrow('Not implemented')
    })
  })

  describe('edge cases', () => {
    it('should handle tools without description', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'mcp',
          name: 'no-description-tool',
          inputSchema: {},
          options: {
            userId: 'user-123',
            sessionId: 'session-123',
            url: 'https://example.com',
            toolName: 'test',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools[0].description).toBeUndefined()
    })

    it('should handle tools without outputSchema', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'ability',
          name: 'no-output-schema',
          inputSchema: {},
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools[0].outputSchema).toBeUndefined()
    })

    it('should handle redis connection errors', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      memcache.hgetall.mockRejectedValue(new Error('Redis timeout'))

      await expect(getEnvironmentTools()).rejects.toThrow('Redis timeout')
    })

    it('should handle empty inputSchema', async () => {
      getContextConversation.mockReturnValue({ id: 'conv-123' })

      const storedTools = [
        {
          handler: 'mcp',
          name: 'empty-schema',
          inputSchema: {},
          options: {
            userId: 'user-123',
            sessionId: 'session-123',
            url: 'https://example.com',
            toolName: 'test',
          },
        },
      ]

      memcache.hgetall.mockResolvedValue({ tools: storedTools })

      const tools = await getEnvironmentTools()

      expect(tools[0].inputSchema).toEqual({})
    })
  })
})
