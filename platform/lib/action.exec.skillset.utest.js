/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { getConfigBySchema } from '@/lib/action.config'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { canUseSkillset } from '@/lib/skillset.access'
import { installEnvironmentTools } from '@/lib/tool.environment'
import { fastGetUserById } from '@/lib/user.get'

import {
  doSkillsetInstall,
  executeSkillsetAction,
} from './action.exec.skillset'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    skillset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/skillset.access', () => ({
  canUseSkillset: jest.fn(),
}))

jest.mock('@/lib/tool.environment', () => ({
  installEnvironmentTools: jest.fn(),
  makeEnvironmentToolSource: (kind, id, prefix) =>
    [kind, id, prefix].filter(Boolean).join(':'),
}))

jest.mock('@/lib/ability.function', () => ({
  ...jest.requireActual('@/lib/ability.function'),
  getAbilityFunctionName: jest.fn(),
  getAbilityFunctionParameters: jest.fn(),
}))

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

describe('action.exec.skillset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('doSkillsetInstall', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      parentId: 'parent-456',
    }

    const mockAbilities = [
      {
        id: 'ability-1',
        name: 'test-ability-1',
        description: 'Test ability 1',
      },
      {
        id: 'ability-2',
        name: 'test-ability-2',
        description: 'Test ability 2',
      },
    ]

    const mockSkillset = {
      id: 'skillset-123',
      name: 'Test Skillset',
      description: 'Test skillset description',
      abilities: mockAbilities,
      userId: 'user-123',
    }

    const mockInput = 'skillset-123'
    const mockParams = {}
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-1',
        skillsetId: 'skillset-123',
        abilityId: 'ability-1',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue(mockUser)
      logEvent.mockResolvedValue(undefined)
      getConfigBySchema.mockReturnValue({
        skillsetId: 'skillset-123',
        prefix: undefined,
      })
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      getAbilityFunctionName.mockImplementation((ability) => ability.name)
      getAbilityFunctionParameters.mockReturnValue({ type: 'object' })
      installEnvironmentTools.mockResolvedValue(true)
    })

    describe('basic functionality', () => {
      it('should install skillset with abilities', async () => {
        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result).toEqual({
          result: {
            success: true,
            tools: ['test-ability-1', 'test-ability-2'],
          },
        })

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.skillset.install',
          relations: {
            blueprintId: 'blueprint-1',
            skillsetId: 'skillset-123',
            abilityId: 'ability-1',
          },
          meta: mockParams,
        })
        expect(getConfigBySchema).toHaveBeenCalledWith({
          input: mockInput,
          params: mockParams,
          initial: {
            skillsetId: mockInput,
          },
          schema: expect.any(Object),
          options: mockOptions,
        })
        expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
          mockUser,
          'skillset-123',
          {
            include: {
              abilities: true,
            },
          }
        )
        expect(canUseSkillset).toHaveBeenCalledWith('user-123', mockSkillset)
        expect(installEnvironmentTools).toHaveBeenCalledWith([
          expect.objectContaining({
            id: 'ability-1',
            name: 'test-ability-1',
            description: 'Test ability 1',
            inputSchema: { type: 'object' },
            options: {
              userId: 'user-123',
              skillsetId: 'skillset-123',
              abilityId: 'ability-1',
            },
            handler: 'ability',
          }),
          expect.objectContaining({
            id: 'ability-2',
            name: 'test-ability-2',
            description: 'Test ability 2',
            inputSchema: { type: 'object' },
            options: {
              userId: 'user-123',
              skillsetId: 'skillset-123',
              abilityId: 'ability-2',
            },
            handler: 'ability',
          }),
        ])
      })

      it('should handle skillset with prefix', async () => {
        getConfigBySchema.mockReturnValue({
          skillsetId: 'skillset-123',
          prefix: 'custom',
        })

        const { getAbilityFunctionName: realGetAbilityFunctionName } =
          jest.requireActual('@/lib/ability.function')

        getAbilityFunctionName.mockImplementation(realGetAbilityFunctionName)

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(getAbilityFunctionName).toHaveBeenCalledWith({
          name: 'custom test-ability-1',
        })
        expect(getAbilityFunctionName).toHaveBeenCalledWith({
          name: 'custom test-ability-2',
        })

        expect(installEnvironmentTools).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ name: 'custom_test_ability_1' }),
            expect.objectContaining({ name: 'custom_test_ability_2' }),
          ])
        )

        expect(result.result.success).toBe(true)
      })

      it('should handle empty abilities array', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
          ...mockSkillset,
          abilities: [],
        })

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result).toEqual({
          result: {
            success: true,
            tools: [],
          },
        })
        expect(installEnvironmentTools).toHaveBeenCalledWith([])
      })
    })

    describe('error handling', () => {
      it('should throw error when user is not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('User not found')

        expect(logEvent).not.toHaveBeenCalled()
        expect(prisma.skillset.findUniqueByIdentifier).not.toHaveBeenCalled()
      })

      it('should throw UserInputError when skillset is not found', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow(UserInputError)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('Skillset not found')
      })

      it('should throw UserInputError when user cannot use skillset', async () => {
        canUseSkillset.mockResolvedValue(false)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow(UserInputError)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('Cannot use skillset')
      })

      it('should propagate errors from logEvent', async () => {
        const logError = new Error('Log error')

        logEvent.mockRejectedValue(logError)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('Log error')
      })

      it('should propagate errors from getConfigBySchema', async () => {
        const configError = new Error('Config error')

        getConfigBySchema.mockImplementation(() => {
          throw configError
        })

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('Config error')
      })

      it('should propagate errors from installEnvironmentTools', async () => {
        const installError = new Error('Install error')

        installEnvironmentTools.mockRejectedValue(installError)

        await expect(
          doSkillsetInstall({
            input: mockInput,
            params: mockParams,
            options: mockOptions,
          })
        ).rejects.toThrow('Install error')
      })
    })

    describe('edge cases', () => {
      it('should handle options without linkedResources', async () => {
        const optionsWithoutLinked = {
          userId: 'user-123',
        }

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: optionsWithoutLinked,
        })

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.skillset.install',
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: mockParams,
        })
        expect(result.result.success).toBe(true)
      })

      it('should handle skillset with single ability', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
          ...mockSkillset,
          abilities: [mockAbilities[0]],
        })

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result.result.tools).toHaveLength(1)
        expect(result.result.tools).toEqual(['test-ability-1'])
      })

      it('should handle installEnvironmentTools returning false', async () => {
        installEnvironmentTools.mockResolvedValue(false)

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result.result.success).toBe(false)
      })

      it('should correctly transform abilities to tools', async () => {
        await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        const toolsArg = installEnvironmentTools.mock.calls[0][0]

        expect(toolsArg).toHaveLength(2)
        expect(toolsArg[0]).toMatchObject({
          id: 'ability-1',
          name: 'test-ability-1',
          description: 'Test ability 1',
          inputSchema: { type: 'object' },
          handler: 'ability',
          options: {
            userId: 'user-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-1',
          },
        })
      })

      it('should handle abilities with undefined prefix', async () => {
        getConfigBySchema.mockReturnValue({
          skillsetId: 'skillset-123',
          prefix: undefined,
        })

        getAbilityFunctionName.mockImplementation(({ name }) => name)

        await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(getAbilityFunctionName).toHaveBeenCalledWith({
          name: 'test-ability-1',
        })
      })

      it('should handle abilities with empty string prefix', async () => {
        getConfigBySchema.mockReturnValue({
          skillsetId: 'skillset-123',
          prefix: '',
        })

        getAbilityFunctionName.mockImplementation(({ name }) => name)

        await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(getAbilityFunctionName).toHaveBeenCalledWith({
          name: 'test-ability-1',
        })
      })

      it('should include extendedDescription when skillset has --- separator', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
          ...mockSkillset,
          description: `Short description for listing
---
Extended description with detailed information about the skillset.
This is used when the skillset is installed.`,
        })

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result.result.extendedDescription).toBe(
          `Extended description with detailed information about the skillset.
This is used when the skillset is installed.`
        )
      })

      it('should not include extendedDescription when no separator exists', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
          ...mockSkillset,
          description: 'Simple description without separator',
        })

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result.result.extendedDescription).toBeUndefined()
      })

      it('should not include extendedDescription when skillset has no description', async () => {
        prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
          ...mockSkillset,
          description: '',
        })

        const result = await doSkillsetInstall({
          input: mockInput,
          params: mockParams,
          options: mockOptions,
        })

        expect(result.result.extendedDescription).toBeUndefined()
      })
    })
  })

  describe('executeSkillsetAction', () => {
    const mockInput = 'skillset-123'
    const mockOptions = {
      userId: 'user-123',
    }

    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSkillset = {
        id: 'skillset-123',
        abilities: [],
        userId: 'user-123',
      }

      fastGetUserById.mockResolvedValue(mockUser)
      logEvent.mockResolvedValue(undefined)
      getConfigBySchema.mockReturnValue({ skillsetId: 'skillset-123' })
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)
      installEnvironmentTools.mockResolvedValue(true)
    })

    describe('operation detection', () => {
      it('should handle install operation', async () => {
        const params = { install: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          mockOptions
        )

        expect(result).toHaveProperty('result')
        expect(result.result).toHaveProperty('success')
        expect(result.result).toHaveProperty('tools')
      })

      it('should handle activate operation (alias for install)', async () => {
        const params = { activate: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          mockOptions
        )

        expect(result).toHaveProperty('result')
        expect(result.result).toHaveProperty('success')
      })

      it('should handle load operation (alias for install)', async () => {
        const params = { load: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          mockOptions
        )

        expect(result).toHaveProperty('result')
        expect(result.result).toHaveProperty('success')
      })

      it('should throw UserInputError for unknown operation', async () => {
        const params = { unknown: true }

        await expect(
          executeSkillsetAction(mockInput, params, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeSkillsetAction(mockInput, params, mockOptions)
        ).rejects.toThrow('Unknown skillset operation')
      })

      it('should throw UserInputError for empty params', async () => {
        const params = {}

        await expect(
          executeSkillsetAction(mockInput, params, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeSkillsetAction(mockInput, params, mockOptions)
        ).rejects.toThrow('Unknown skillset operation')
      })
    })

    describe('integration with doSkillsetInstall', () => {
      it('should call doSkillsetInstall with correct parameters for install', async () => {
        const params = { install: true, additionalParam: 'value' }

        await executeSkillsetAction(mockInput, params, mockOptions)

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(installEnvironmentTools).toHaveBeenCalled()
      })

      it('should call doSkillsetInstall with correct parameters for activate', async () => {
        const params = { activate: true, prefix: 'custom' }

        await executeSkillsetAction(mockInput, params, mockOptions)

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      })

      it('should call doSkillsetInstall with correct parameters for load', async () => {
        const params = { load: true }

        await executeSkillsetAction(mockInput, params, mockOptions)

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      })

      it('should propagate errors from doSkillsetInstall', async () => {
        const installError = new Error('Install failed')

        fastGetUserById.mockRejectedValue(installError)

        const params = { install: true }

        await expect(
          executeSkillsetAction(mockInput, params, mockOptions)
        ).rejects.toThrow('Install failed')
      })
    })

    describe('edge cases', () => {
      it('should handle multiple operation flags (first wins)', async () => {
        const params = { install: true, activate: true, load: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          mockOptions
        )

        expect(result).toHaveProperty('result')
      })

      it('should handle params with falsy values', async () => {
        const params = { install: false, activate: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          mockOptions
        )

        expect(result).toHaveProperty('result')
      })

      it('should handle empty input string', async () => {
        getConfigBySchema.mockReturnValue({ skillsetId: '' })

        const params = { install: true }

        const result = await executeSkillsetAction('', params, mockOptions)

        expect(result).toHaveProperty('result')
      })

      it('should handle null-like values in options', async () => {
        const optionsMinimal = {
          userId: 'user-123',
          linkedResources: undefined,
        }

        const params = { install: true }

        const result = await executeSkillsetAction(
          mockInput,
          params,
          optionsMinimal
        )

        expect(result).toHaveProperty('result')
      })
    })
  })
})
