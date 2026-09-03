/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { canManipulateDataset, canUseDataset } from '@/lib/dataset.access'
import { schema } from '@/lib/joi.handler'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

import datasetIdSchema from '@/schemas/datasetId'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/dataset.access', () => ({
  canUseDataset: jest.fn(),
  canManipulateDataset: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(),
  throwNotAuthorized: jest.fn(),
  throwNotFound: jest.fn(),
}))

describe('datasetIdSchema', () => {
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
        datasetId: datasetIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { datasetId: null }, { datasetId: null })
      await validate(s, { datasetId: '' }, { datasetId: null })
      await validate(s, { datasetId: '  ' }, { datasetId: null })
    })
  })

  describe('with accessType "use"', () => {
    const useSchema = datasetIdSchema('use')

    it('should allow null values', async () => {
      const result = await useSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.dataset.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should throw not authenticated when no user in session', async () => {
      const mockError = new Error('Not authenticated')

      throwNotAuthenticated.mockImplementation(() => {
        throw mockError
      })

      const context = { session: {} }

      await expect(
        useSchema.validateAsync('dataset-123', { context })
      ).rejects.toThrow('Not authenticated')

      expect(throwNotAuthenticated).toHaveBeenCalledWith()
    })

    it('should find and return dataset for valid user and dataset id', async () => {
      const mockUser = { id: 'user-123' }
      const mockDataset = {
        id: 'dataset-123',
        name: 'Test Dataset',
        userId: 'user-123',
      }
      const context = { session: { user: mockUser } }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)

      const result = await useSchema.validateAsync('dataset-123', { context })

      expect(result).toEqual(mockDataset)
      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'dataset-123'
      )
      expect(canUseDataset).toHaveBeenCalledWith(mockUser.id, mockDataset)
    })

    it('should throw not found when dataset does not exist', async () => {
      const mockUser = { id: 'user-123' }
      const context = { session: { user: mockUser } }
      const mockError = new Error('Dataset not found')

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)
      throwNotFound.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('non-existent-dataset', { context })
      ).rejects.toThrow('Dataset not found')

      expect(throwNotFound).toHaveBeenCalledWith('Dataset not found')
    })

    it('should throw not authorized when user cannot use dataset', async () => {
      const mockUser = { id: 'user-123' }
      const mockDataset = {
        id: 'dataset-123',
        name: 'Test Dataset',
        userId: 'other-user',
      }
      const context = { session: { user: mockUser } }
      const mockError = new Error('You are not authorized to use this dataset')

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('dataset-123', { context })
      ).rejects.toThrow('You are not authorized to use this dataset')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to use this dataset'
      )
    })
  })

  describe('with accessType "manipulate"', () => {
    const manipulateSchema = datasetIdSchema('manipulate')

    it('should allow null values', async () => {
      const result = await manipulateSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.dataset.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should find and return dataset when user can manipulate it', async () => {
      const mockUser = { id: 'user-123' }
      const mockDataset = {
        id: 'dataset-123',
        name: 'Test Dataset',
        userId: 'user-123',
      }
      const context = { session: { user: mockUser } }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canManipulateDataset.mockResolvedValue(true)

      const result = await manipulateSchema.validateAsync('dataset-123', {
        context,
      })

      expect(result).toEqual(mockDataset)
      expect(canManipulateDataset).toHaveBeenCalledWith(
        mockUser.id,
        mockDataset
      )
    })

    it('should throw not authorized when user cannot manipulate dataset', async () => {
      const mockUser = { id: 'user-123' }
      const mockDataset = {
        id: 'dataset-123',
        name: 'Test Dataset',
        userId: 'other-user',
      }
      const context = { session: { user: mockUser } }
      const mockError = new Error(
        'You are not authorized to manipulate this dataset'
      )

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canManipulateDataset.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        manipulateSchema.validateAsync('dataset-123', { context })
      ).rejects.toThrow('You are not authorized to manipulate this dataset')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to manipulate this dataset'
      )
    })
  })
})
