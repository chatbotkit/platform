/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { deleteBlueprint } from './blueprint.delete'
import { deleteManyBots } from './bot.delete'
import { deleteManyDatasets } from './dataset.delete'
import { deleteManySkillsets } from './skillset.delete'
import { deleteManySpaces } from './space.delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('./bot.delete', () => ({
  deleteManyBots: jest.fn(),
}))

jest.mock('./dataset.delete', () => ({
  deleteManyDatasets: jest.fn(),
}))

jest.mock('./skillset.delete', () => ({
  deleteManySkillsets: jest.fn(),
}))

jest.mock('./space.delete', () => ({
  deleteManySpaces: jest.fn(),
}))

// @note a recording transaction client. Every `tx.<model>.deleteMany` records a
// jest.fn keyed by model, so the test can assert what was deleted without
// enumerating the models up front (completeness is proven by the coverage test).
function createMockTx() {
  const deleteManyByModel = {}
  const blueprintDelete = jest.fn()

  const tx = new Proxy(
    { blueprint: { delete: blueprintDelete } },
    {
      get(target, prop) {
        if (prop === 'blueprint') {
          return target.blueprint
        }

        if (typeof prop !== 'string') {
          return undefined
        }

        if (!deleteManyByModel[prop]) {
          deleteManyByModel[prop] = jest.fn()
        }

        return { deleteMany: deleteManyByModel[prop] }
      },
    }
  )

  return { tx, deleteManyByModel, blueprintDelete }
}

describe('deleteBlueprint', () => {
  const mockBlueprint = {
    id: 'blueprint-123',
    userId: 'user-123',
  }

  const expectedWhere = {
    blueprintId: mockBlueprint.id,
    userId: mockBlueprint.userId,
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('when deleteResources is false or not provided', () => {
    it('should delete only the blueprint', async () => {
      await deleteBlueprint(mockBlueprint, { deleteResources: false })

      expect(prisma.blueprint.delete).toHaveBeenCalledWith({
        where: { id: mockBlueprint.id },
      })

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should delete only the blueprint when option is not provided', async () => {
      await deleteBlueprint(mockBlueprint)

      expect(prisma.blueprint.delete).toHaveBeenCalledWith({
        where: { id: mockBlueprint.id },
      })

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should delete only the blueprint when empty options object is provided', async () => {
      await deleteBlueprint(mockBlueprint, {})

      expect(prisma.blueprint.delete).toHaveBeenCalledWith({
        where: { id: mockBlueprint.id },
      })

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('when deleteResources is true', () => {
    it('should delete all resources and the blueprint in a transaction', async () => {
      prisma.bot.findMany.mockResolvedValue([{ id: 'bot-1' }, { id: 'bot-2' }])
      prisma.dataset.findMany.mockResolvedValue([{ id: 'dataset-1' }])
      prisma.skillset.findMany.mockResolvedValue([{ id: 'skillset-1' }])
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1' }])

      const { tx, deleteManyByModel, blueprintDelete } = createMockTx()

      prisma.$transaction.mockImplementation(async (callback) => callback(tx))

      await deleteBlueprint(mockBlueprint, { deleteResources: true })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)

      // Verify helper-managed resources were fetched before deletion
      expect(prisma.bot.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: { id: true },
      })
      expect(prisma.dataset.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: { id: true },
      })
      expect(prisma.skillset.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: { id: true },
      })
      expect(prisma.space.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: { id: true },
      })

      // Every model the transaction touched was deleted scoped by blueprint+user
      const deletedModels = Object.keys(deleteManyByModel)

      expect(deletedModels.length).toBeGreaterThan(20)

      for (const model of deletedModels) {
        expect(deleteManyByModel[model]).toHaveBeenCalledWith({
          where: expectedWhere,
        })
      }

      // ...including a representative spread of integrations, oauth, objects and
      // primitives (full completeness is enforced by the coverage test)
      expect(deletedModels).toEqual(
        expect.arrayContaining([
          'slackIntegration',
          'githubIntegration',
          'oAuthConnection',
          'task',
          'policy',
          'file',
        ])
      )

      // Verify the helper deletes were called for the fetched resources
      expect(deleteManyBots).toHaveBeenCalledWith([
        { id: 'bot-1' },
        { id: 'bot-2' },
      ])
      expect(deleteManyDatasets).toHaveBeenCalledWith([{ id: 'dataset-1' }])
      expect(deleteManySkillsets).toHaveBeenCalledWith([{ id: 'skillset-1' }])
      expect(deleteManySpaces).toHaveBeenCalledWith([{ id: 'space-1' }])

      // Verify the blueprint itself is deleted (always, last, outside the tx so
      // it survives as an anchor if resource cleanup fails partway)
      expect(prisma.blueprint.delete).toHaveBeenCalledWith({
        where: { id: mockBlueprint.id },
      })
      expect(blueprintDelete).not.toHaveBeenCalled()
    })

    it('should delete integrations, then helper resources, then the blueprint last', async () => {
      prisma.bot.findMany.mockResolvedValue([{ id: 'bot-1' }])
      prisma.dataset.findMany.mockResolvedValue([])
      prisma.skillset.findMany.mockResolvedValue([])
      prisma.space.findMany.mockResolvedValue([])

      const order = []

      const tx = new Proxy(
        {},
        {
          get(_target, prop) {
            if (typeof prop !== 'string') {
              return undefined
            }

            return {
              deleteMany: jest.fn(async () => {
                order.push(prop)
              }),
            }
          },
        }
      )

      deleteManyBots.mockImplementation(async () => {
        order.push('deleteManyBots')
      })

      prisma.$transaction.mockImplementation(async (callback) => callback(tx))
      prisma.blueprint.delete.mockImplementation(async () => {
        order.push('blueprint')
      })

      await deleteBlueprint(mockBlueprint, { deleteResources: true })

      // integrations (in the tx) first, then the helper deletes, then the
      // blueprint row itself, last
      expect(order.indexOf('slackIntegration')).toBeLessThan(
        order.indexOf('deleteManyBots')
      )
      expect(order.indexOf('deleteManyBots')).toBeLessThan(
        order.indexOf('blueprint')
      )
    })

    it('should handle transaction rollback on error', async () => {
      const testError = new Error('Database error')

      prisma.$transaction.mockRejectedValue(testError)

      await expect(
        deleteBlueprint(mockBlueprint, { deleteResources: true })
      ).rejects.toThrow('Database error')

      // Verify simple blueprint.delete was not called after error
      expect(prisma.blueprint.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle blueprint with no userId gracefully', async () => {
      const blueprintWithoutUserId = {
        id: 'blueprint-123',
        userId: undefined,
      }

      await deleteBlueprint(blueprintWithoutUserId, { deleteResources: false })

      expect(prisma.blueprint.delete).toHaveBeenCalledWith({
        where: { id: blueprintWithoutUserId.id },
      })
    })

    it('should pass through transaction callback correctly', async () => {
      let callbackExecuted = false

      prisma.bot.findMany.mockResolvedValue([])
      prisma.dataset.findMany.mockResolvedValue([])
      prisma.skillset.findMany.mockResolvedValue([])
      prisma.space.findMany.mockResolvedValue([])

      const { tx } = createMockTx()

      prisma.$transaction.mockImplementation(async (callback) => {
        callbackExecuted = true

        return await callback(tx)
      })

      await deleteBlueprint(mockBlueprint, { deleteResources: true })

      expect(callbackExecuted).toBe(true)
    })
  })
})
