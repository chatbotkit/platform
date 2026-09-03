/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { schema } from '@/lib/joi.handler'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { canManipulateSkillset, canUseSkillset } from '@/lib/skillset.access'

import skillsetIdSchema from '@/schemas/skillsetId'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/skillset.access', () => ({
  canUseSkillset: jest.fn(),
  canManipulateSkillset: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(),
  throwNotAuthorized: jest.fn(),
  throwNotFound: jest.fn(),
}))

describe('skillsetIdSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockReset(prisma)
  })

  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input)

      expect(response).toEqual(expected)
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should correctly handle falsy values', async () => {
      const s = schema.object({
        skillsetId: skillsetIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { skillsetId: null }, { skillsetId: null })
      await validate(s, { skillsetId: '' }, { skillsetId: null })
      await validate(s, { skillsetId: '  ' }, { skillsetId: null })
    })
  })

  describe('with accessType "use"', () => {
    const useSchema = skillsetIdSchema('use')

    it('should allow null values', async () => {
      const result = await useSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.skillset.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should throw not authenticated when no user in session', async () => {
      const mockError = new Error('Not authenticated')

      throwNotAuthenticated.mockImplementation(() => {
        throw mockError
      })

      const context = { session: {} }

      await expect(
        useSchema.validateAsync('skillset-123', { context })
      ).rejects.toThrow('Not authenticated')

      expect(throwNotAuthenticated).toHaveBeenCalledWith()
    })

    it('should find and return skillset for valid user and skillset id', async () => {
      const mockUser = { id: 'user-123' }
      const mockSkillset = {
        id: 'skillset-123',
        name: 'Test Skillset',
        userId: 'user-123',
      }
      const context = { session: { user: mockUser } }

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(true)

      const result = await useSchema.validateAsync('skillset-123', { context })

      expect(result).toEqual(mockSkillset)
      expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'skillset-123'
      )
      expect(canUseSkillset).toHaveBeenCalledWith(mockUser.id, mockSkillset)
    })

    it('should throw not found when skillset does not exist', async () => {
      const mockUser = { id: 'user-123' }
      const context = { session: { user: mockUser } }
      const mockError = new Error('Skillset not found')

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)
      throwNotFound.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('non-existent-skillset', { context })
      ).rejects.toThrow('Skillset not found')

      expect(throwNotFound).toHaveBeenCalledWith('Skillset not found')
    })

    it('should throw not authorized when user cannot use skillset', async () => {
      const mockUser = { id: 'user-123' }
      const mockSkillset = {
        id: 'skillset-123',
        name: 'Test Skillset',
        userId: 'other-user',
      }
      const context = { session: { user: mockUser } }
      const mockError = new Error('You are not authorized to use this skillset')

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canUseSkillset.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('skillset-123', { context })
      ).rejects.toThrow('You are not authorized to use this skillset')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to use this skillset'
      )
    })
  })

  describe('with accessType "manipulate"', () => {
    const manipulateSchema = skillsetIdSchema('manipulate')

    it('should allow null values', async () => {
      const result = await manipulateSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.skillset.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should find and return skillset when user can manipulate it', async () => {
      const mockUser = { id: 'user-123' }
      const mockSkillset = {
        id: 'skillset-123',
        name: 'Test Skillset',
        userId: 'user-123',
      }
      const context = { session: { user: mockUser } }

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canManipulateSkillset.mockResolvedValue(true)

      const result = await manipulateSchema.validateAsync('skillset-123', {
        context,
      })

      expect(result).toEqual(mockSkillset)
      expect(canManipulateSkillset).toHaveBeenCalledWith(
        mockUser.id,
        mockSkillset
      )
    })

    it('should throw not authorized when user cannot manipulate skillset', async () => {
      const mockUser = { id: 'user-123' }
      const mockSkillset = {
        id: 'skillset-123',
        name: 'Test Skillset',
        userId: 'other-user',
      }
      const context = { session: { user: mockUser } }
      const mockError = new Error(
        'You are not authorized to manipulate this skillset'
      )

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      canManipulateSkillset.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        manipulateSchema.validateAsync('skillset-123', { context })
      ).rejects.toThrow('You are not authorized to manipulate this skillset')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to manipulate this skillset'
      )
    })
  })
})
