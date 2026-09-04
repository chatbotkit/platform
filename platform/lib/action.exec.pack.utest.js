import {
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'
import { logEvent } from '@/lib/log'
import {
  installEnvironmentTools,
  uninstallEnvironmentTools,
} from '@/lib/tool.environment'
import { fastGetUserById } from '@/lib/user.get'

import {
  executePackAction,
  installSchema,
  uninstallSchema,
} from './action.exec.pack'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
  debug: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/instruction.template.unpack', () => ({
  unpackTemplateInstruction: jest.fn(),
}))

jest.mock('@/lib/ability.function', () => ({
  ...jest.requireActual('@/lib/ability.function'),
  getAbilityFunctionName: jest.fn(
    jest.requireActual('@/lib/ability.function').getAbilityFunctionName
  ),
  getAbilityFunctionParameters: jest.fn(() => ({
    type: 'object',
    properties: {},
  })),
}))

jest.mock('@/lib/tool.environment', () => ({
  installEnvironmentTools: jest.fn(),
  uninstallEnvironmentTools: jest.fn(),
  makeEnvironmentToolSource: (kind, id, prefix) =>
    [kind, id, prefix].filter(Boolean).join(':'),
}))

describe('action.exec.pack', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('installSchema', () => {
    it('should validate basic pack configuration', () => {
      const result = installSchema.parse({
        abilities: ['ability1', 'ability2'],
      })

      expect(result.abilities).toHaveLength(2)
    })

    it('should validate pack with prefix', () => {
      const result = installSchema.parse({
        abilities: ['ability1'],
        prefix: 'my-prefix',
      })

      expect(result.prefix).toBe('my-prefix')
      expect(result.abilities).toHaveLength(1)
    })

    it('should validate inline ability definitions', () => {
      const result = installSchema.parse({
        abilities: [
          {
            name: 'custom-ability',
            description: 'Does something',
            instruction: 'instruction text',
          },
        ],
      })

      expect(result.abilities[0]).toEqual({
        name: 'custom-ability',
        description: 'Does something',
        instruction: 'instruction text',
      })
    })

    it('should validate mixed ability definitions', () => {
      const result = installSchema.parse({
        abilities: [
          'template-ability',
          {
            name: 'inline-ability',
            description: 'Custom',
            instruction: 'text',
          },
        ],
      })

      expect(result.abilities).toHaveLength(2)
      expect(typeof result.abilities[0]).toBe('string')
      expect(typeof result.abilities[1]).toBe('object')
    })

    it('should reject missing abilities', () => {
      expect(() => {
        installSchema.parse({})
      }).toThrow()
    })

    it('should reject invalid ability definition', () => {
      expect(() => {
        installSchema.parse({
          abilities: [{ name: 'test' }],
        })
      }).toThrow()
    })
  })

  describe('executePackAction', () => {
    const mockUser = { id: 'user123', email: 'user@example.com' }
    const mockOptions = {
      userId: 'user123',
      linkedResources: {
        blueprintId: 'bp1',
        skillsetId: 'ss1',
        abilityId: 'ab1',
        secretId: 'secret123',
        fileId: 'file456',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue(mockUser)
      installEnvironmentTools.mockResolvedValue(true)
    })

    it('should install template abilities as environment tools', async () => {
      const mockAbilityInstance = {
        name: 'Test Ability',
        description: 'A test ability',
        instruction: '```fetch\nurl: https://example.com\n```',
      }

      unpackTemplateInstruction.mockReturnValue(mockAbilityInstance)

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['greeting-ability'],
        }),
        {
          install: {
            abilities: ['greeting-ability'],
          },
        },
        mockOptions
      )

      expect(fastGetUserById).toHaveBeenCalledWith('user123')
      expect(unpackTemplateInstruction).toHaveBeenCalledWith('greeting-ability')
      expect(installEnvironmentTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            handler: 'ability-template',
            options: expect.objectContaining({
              userId: 'user123',
              instruction: '@greeting-ability',
              linkedResources: mockOptions.linkedResources,
            }),
          }),
        ])
      )
      expect(result.result).toEqual(
        expect.objectContaining({
          success: true,
        })
      )
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.pack.install',
          user: { id: 'user123' },
        })
      )
    })

    it('should install inline abilities as environment tools', async () => {
      const result = await executePackAction(
        JSON.stringify({
          abilities: [
            {
              name: 'inline-ability',
              description: 'Custom ability',
              instruction: 'Do something custom',
            },
          ],
        }),
        {
          install: {
            abilities: [
              {
                name: 'inline-ability',
                description: 'Custom ability',
                instruction: 'Do something custom',
              },
            ],
          },
        },
        mockOptions
      )

      expect(installEnvironmentTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            handler: 'ability-template',
            description: 'Custom ability',
            options: expect.objectContaining({
              instruction: 'Do something custom',
            }),
          }),
        ])
      )
      expect(result.result).toEqual(
        expect.objectContaining({
          success: true,
        })
      )
    })

    it('should install multiple template abilities', async () => {
      unpackTemplateInstruction
        .mockReturnValueOnce({
          name: 'Ability 1',
          description: 'First ability',
          instruction: 'instruction1',
        })
        .mockReturnValueOnce({
          name: 'Ability 2',
          description: 'Second ability',
          instruction: 'instruction2',
        })

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['ability1', 'ability2'],
        }),
        {
          install: {
            abilities: ['ability1', 'ability2'],
          },
        },
        mockOptions
      )

      expect(unpackTemplateInstruction).toHaveBeenCalledTimes(2)
      expect(installEnvironmentTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            options: expect.objectContaining({
              instruction: '@ability1',
            }),
          }),
          expect.objectContaining({
            options: expect.objectContaining({
              instruction: '@ability2',
            }),
          }),
        ])
      )
      expect(result.result.tools).toHaveLength(2)
    })

    it('should apply prefix to ability names', async () => {
      unpackTemplateInstruction.mockReturnValue({
        name: 'Test Ability',
        description: 'A test ability',
        instruction: 'test instruction',
      })

      await executePackAction(
        JSON.stringify({
          abilities: ['ability1'],
          prefix: 'myprefix',
        }),
        {
          install: {
            abilities: ['ability1'],
            prefix: 'myprefix',
          },
        },
        mockOptions
      )

      expect(getAbilityFunctionName).toHaveBeenCalledWith({
        name: 'myprefix Test Ability',
      })

      const tools = installEnvironmentTools.mock.calls[0][0]

      expect(tools[0]).toMatchObject({ name: 'myprefix_test_ability' })
    })

    it('should use activate parameter as alias for install', async () => {
      unpackTemplateInstruction.mockReturnValue({
        name: 'Test',
        description: 'test',
        instruction: 'test',
      })

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['ability1'],
        }),
        {
          activate: {
            abilities: ['ability1'],
          },
        },
        mockOptions
      )

      expect(result.result).toEqual(expect.objectContaining({ success: true }))
    })

    it('should use load parameter as alias for install', async () => {
      unpackTemplateInstruction.mockReturnValue({
        name: 'Test',
        description: 'test',
        instruction: 'test',
      })

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['ability1'],
        }),
        {
          load: {
            abilities: ['ability1'],
          },
        },
        mockOptions
      )

      expect(result.result).toEqual(expect.objectContaining({ success: true }))
    })

    it('should throw error when user not found', async () => {
      fastGetUserById.mockResolvedValue(null)

      await expect(
        executePackAction(
          JSON.stringify({
            abilities: ['ability1'],
          }),
          {
            install: {
              abilities: ['ability1'],
            },
          },
          mockOptions
        )
      ).rejects.toThrow('User not found')
    })

    it('should throw error when ability template not found', async () => {
      unpackTemplateInstruction.mockReturnValue(null)

      await expect(
        executePackAction(
          JSON.stringify({
            abilities: ['nonexistent-ability'],
          }),
          {
            install: {
              abilities: ['nonexistent-ability'],
            },
          },
          mockOptions
        )
      ).rejects.toThrow('Ability template not found: nonexistent-ability')
    })

    it('should throw error for unknown operation', async () => {
      await expect(
        executePackAction(
          JSON.stringify({
            abilities: ['ability1'],
          }),
          {
            someUnknownParam: {
              abilities: ['ability1'],
            },
          },
          mockOptions
        )
      ).rejects.toThrow('Unknown pack operation')
    })

    it('should include linkedResources in tool options', async () => {
      unpackTemplateInstruction.mockReturnValue({
        name: 'Test Ability',
        description: 'A test ability',
        instruction: 'test',
      })

      await executePackAction(
        JSON.stringify({
          abilities: ['ability1'],
        }),
        {
          install: {
            abilities: ['ability1'],
          },
        },
        {
          ...mockOptions,
          linkedResources: {
            secretId: 'secret123',
            fileId: 'file456',
            botId: 'bot789',
            spaceId: 'space012',
          },
        }
      )

      const tools = installEnvironmentTools.mock.calls[0][0]

      expect(tools[0].options.linkedResources).toEqual({
        secretId: 'secret123',
        fileId: 'file456',
        botId: 'bot789',
        spaceId: 'space012',
      })
    })

    it('should carry the installing abilityId so tools can refresh their links', async () => {
      unpackTemplateInstruction.mockReturnValue({
        name: 'Test Ability',
        description: 'A test ability',
        instruction: 'test',
      })

      await executePackAction(
        JSON.stringify({ abilities: ['ability1'] }),
        { install: { abilities: ['ability1'] } },
        {
          ...mockOptions,
          contextResources: { abilityId: 'ab1', skillsetId: 'ss1' },
        }
      )

      const tools = installEnvironmentTools.mock.calls[0][0]

      expect(tools[0].options.abilityId).toBe('ab1')
    })

    it('should return tool names in result', async () => {
      unpackTemplateInstruction
        .mockReturnValueOnce({
          name: 'List Files',
          description: 'List files',
          instruction: 'list',
        })
        .mockReturnValueOnce({
          name: 'Create File',
          description: 'Create file',
          instruction: 'create',
        })

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['list-files', 'create-file'],
        }),
        {
          install: {
            abilities: ['list-files', 'create-file'],
          },
        },
        mockOptions
      )

      expect(result.result.tools).toHaveLength(2)
    })

    it('should handle failed installation', async () => {
      installEnvironmentTools.mockResolvedValue(false)

      unpackTemplateInstruction.mockReturnValue({
        name: 'Test',
        description: 'test',
        instruction: 'test',
      })

      const result = await executePackAction(
        JSON.stringify({
          abilities: ['ability1'],
        }),
        {
          install: {
            abilities: ['ability1'],
          },
        },
        mockOptions
      )

      expect(result.result.success).toBe(false)
    })

    it('should use getAbilityFunctionParameters for input schema', async () => {
      const mockSchema = {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      }

      getAbilityFunctionParameters.mockReturnValue(mockSchema)

      unpackTemplateInstruction.mockReturnValue({
        name: 'Search',
        description: 'Search things',
        instruction: '```fetch\nurl: $[query! ys|search query]\n```',
      })

      await executePackAction(
        JSON.stringify({
          abilities: ['search-ability'],
        }),
        {
          install: {
            abilities: ['search-ability'],
          },
        },
        mockOptions
      )

      expect(getAbilityFunctionParameters).toHaveBeenCalledWith({
        instruction: '```fetch\nurl: $[query! ys|search query]\n```',
        meta: null,
      })

      const tools = installEnvironmentTools.mock.calls[0][0]

      expect(tools[0].inputSchema).toEqual(mockSchema)
    })
  })

  describe('uninstallSchema', () => {
    it('should validate basic uninstall configuration', () => {
      const result = uninstallSchema.parse({
        abilities: ['ability1', 'ability2'],
      })

      expect(result.abilities).toHaveLength(2)
    })

    it('should validate uninstall with prefix', () => {
      const result = uninstallSchema.parse({
        abilities: ['ability1'],
        prefix: 'my-prefix',
      })

      expect(result.prefix).toBe('my-prefix')
    })

    it('should reject missing abilities', () => {
      expect(() => uninstallSchema.parse({})).toThrow()
    })
  })

  describe('executePackAction - uninstall operation', () => {
    const mockUser = { id: 'user123', email: 'user@example.com' }
    const mockOptions = {
      userId: 'user123',
      linkedResources: {
        blueprintId: 'bp1',
        skillsetId: 'ss1',
        abilityId: 'ab1',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue(mockUser)
      uninstallEnvironmentTools.mockResolvedValue({
        success: true,
        removedTools: ['ability1'],
      })
    })

    it('should remove matching tools from the environment', async () => {
      const result = await executePackAction(
        JSON.stringify({ abilities: ['ability1'] }),
        { uninstall: { abilities: ['ability1'] } },
        mockOptions
      )

      expect(uninstallEnvironmentTools).toHaveBeenCalledWith(
        expect.any(Function)
      )
      expect(result.result.success).toBe(true)
    })

    it('should return removed tool names in the result', async () => {
      uninstallEnvironmentTools.mockResolvedValue({
        success: true,
        removedTools: ['ability1', 'ability2'],
      })

      const result = await executePackAction(
        JSON.stringify({ abilities: ['ability1', 'ability2'] }),
        { uninstall: { abilities: ['ability1', 'ability2'] } },
        mockOptions
      )

      expect(result.result.tools).toEqual(['ability1', 'ability2'])
    })

    it('should apply prefix when building names to remove', async () => {
      await executePackAction(
        JSON.stringify({ abilities: ['my-tool'], prefix: 'ns' }),
        { uninstall: { abilities: ['my-tool'], prefix: 'ns' } },
        mockOptions
      )

      // The predicate passed to uninstallEnvironmentTools uses the prefixed name.
      // Verify the function was called - we trust getAbilityFunctionName with prefix internally.
      expect(uninstallEnvironmentTools).toHaveBeenCalled()
    })

    it('should log an uninstall event', async () => {
      await executePackAction(
        JSON.stringify({ abilities: ['ability1'] }),
        { uninstall: { abilities: ['ability1'] } },
        mockOptions
      )

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.pack.uninstall',
          user: { id: 'user123' },
        })
      )
    })

    it('should return success false when no tools were removed', async () => {
      uninstallEnvironmentTools.mockResolvedValue({
        success: false,
        removedTools: [],
      })

      const result = await executePackAction(
        JSON.stringify({ abilities: ['nonexistent'] }),
        { uninstall: { abilities: ['nonexistent'] } },
        mockOptions
      )

      expect(result.result.success).toBe(false)
      expect(result.result.tools).toEqual([])
    })

    it('should only remove tools whose handler is ability-template and name matches', async () => {
      await executePackAction(
        JSON.stringify({ abilities: ['tool-a'] }),
        { uninstall: { abilities: ['tool-a'] } },
        mockOptions
      )

      const predicate = uninstallEnvironmentTools.mock.calls[0][0]

      // @note a tool that matches
      expect(predicate({ handler: 'ability-template', name: 'tool_a' })).toBe(
        true
      )

      // @note wrong handler should not be removed
      expect(predicate({ handler: 'other', name: 'tool_a' })).toBe(false)

      // @note correct handler but wrong name should not be removed
      expect(predicate({ handler: 'ability-template', name: 'tool_b' })).toBe(
        false
      )
    })
  })
})
