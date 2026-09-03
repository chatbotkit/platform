/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import { deleteCustomer } from '@chatbotkit-dev/billing/provider'

import prisma from '@/prisma/client'

import { deleteBlueprint } from '@/lib/blueprint.delete'
import { deleteManyBots } from '@/lib/bot.delete'
import { deleteConversation } from '@/lib/conversation.delete'
import { deleteDataset } from '@/lib/dataset.delete'
import { captureError } from '@/lib/error'
import { deleteFile } from '@/lib/file.delete'
import { notifyUserDeleted } from '@/lib/notify'
import { throwNotFound } from '@/lib/response'
import { deleteManySkillsets } from '@/lib/skillset.delete'
import { deleteManySpaces } from '@/lib/space.delete'

import { deleteUser } from './user.delete'

import fs from 'node:fs'

jest.mock('@/prisma/client', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/blueprint.delete', () => ({
  deleteBlueprint: jest.fn(),
}))

jest.mock('@/lib/bot.delete', () => ({
  deleteManyBots: jest.fn(),
}))

jest.mock('@/lib/conversation.delete', () => ({
  deleteConversation: jest.fn(),
}))

jest.mock('@/lib/dataset.delete', () => ({
  deleteDataset: jest.fn(),
}))

jest.mock('@/lib/file.delete', () => ({
  deleteFile: jest.fn(),
}))

jest.mock('@/lib/skillset.delete', () => ({
  deleteManySkillsets: jest.fn(),
}))

jest.mock('@/lib/space.delete', () => ({
  deleteManySpaces: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyUserDeleted: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw new Error('Not found')
  }),
}))

jest.mock('@chatbotkit-dev/email', () => ({}))

jest.mock('@chatbotkit-dev/billing/provider', () => ({
  ...jest.requireActual('@chatbotkit-dev/billing/provider'),
  __esModule: true,
  deleteCustomer: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
  log: jest.fn(),
}))

// @note job.ts helpers are kept real - they just orchestrate the mocked
// delete helpers, so there is no need to stub them out

/**
 * Build an async generator that yields the given items and records the args it
 * was called with so tests can assert the `where` clause was user-scoped.
 */
function makePaginate(items = []) {
  const calls = []

  const paginate = jest.fn((args) => {
    calls.push(args)

    return (async function* () {
      yield* items
    })()
  })

  paginate.calls = calls

  return paginate
}

function makeDeleteMany(result = { count: 0 }) {
  return jest.fn().mockResolvedValue(result)
}

function getDirectUserOwnedModelsFromSchema() {
  // @note the schema lives in the installed database module now - resolving it
  // through the package name keeps this test working whichever module is
  // installed
  const schemaPath = require.resolve('@chatbotkit-dev/db/schema')
  const schema = fs.readFileSync(schemaPath, 'utf8')

  return [...schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)]
    .map(([, modelName, block]) => ({ modelName, block }))
    .filter(({ modelName }) => modelName !== 'User')
    .filter(
      ({ block }) =>
        /^\s*userId\s+String\b/m.test(block) &&
        /^\s*user\s+User\??\s+@relation\([^\n]*fields:\s*\[userId\][^\n]*references:\s*\[id\]/m.test(
          block
        )
    )
    .map(({ modelName }) => modelName)
    .sort()
}

function toPrismaDelegateName(modelName) {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`
}

function assignTrackedModelMock(
  trackedModelCalls,
  modelName,
  methodName,
  mock
) {
  const delegateName = toPrismaDelegateName(modelName)

  prisma[delegateName][methodName] = mock

  const trackedEntry = trackedModelCalls.get(modelName) || {}

  trackedModelCalls.set(modelName, {
    ...trackedEntry,
    [methodName]: mock,
  })

  return mock
}

const USER_ID = 'user-abc'

const userDeleteHelperHandledModels = [
  'Blueprint',
  'Bot',
  'Conversation',
  'Dataset',
  'File',
  'Skillset',
  'Space',
]

const userDeleteDirectDeleteManyModels = [
  'Account',
  'Ability',
  'AuditLog',
  'Contact',
  'DiscordIntegration',
  'EmailIntegration',
  'EventLog',
  'EventMetric',
  'ExtractIntegration',
  'GooglechatIntegration',
  'HubBlueprintPage',
  'HubBotPage',
  'HubDatasetPage',
  'HubSkillsetPage',
  'HubWidgetPage',
  'InstagramIntegration',
  'Lock',
  'McpserverIntegration',
  'Memory',
  'MessengerIntegration',
  'NotionIntegration',
  'OAuthApplication',
  'OAuthApplicationToken',
  'OAuthConnection',
  'Policy',
  'Portal',
  'Rating',
  'Secret',
  'Session',
  'SitemapIntegration',
  'SkillserverIntegration',
  'SlackIntegration',
  'SpaceSite',
  'SupportIntegration',
  'Task',
  'TaskExecution',
  'Team',
  'MicrosoftteamsIntegration',
  'TelegramIntegration',
  'Token',
  'TriggerIntegration',
  'TwilioIntegration',
  'SecretValue',
  'Webhook',
  'WhatsappIntegration',
  'WidgetIntegration',
]

const userDeleteCoverageExcludedModels = ['Usage']

const mockUser = {
  id: USER_ID,
  email: 'test@example.com',
  billingCustomerId: null,
}

let trackedModelCalls
let directUserOwnedModels

describe('deleteUser', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    directUserOwnedModels = getDirectUserOwnedModelsFromSchema()
    trackedModelCalls = new Map()

    // @note coverage is driven from the schema, not from the inclusion lists,
    // so commenting a model out of a manual array does not weaken protection
    for (const modelName of directUserOwnedModels) {
      if (userDeleteCoverageExcludedModels.includes(modelName)) {
        continue
      }

      assignTrackedModelMock(
        trackedModelCalls,
        modelName,
        'paginate',
        makePaginate()
      )
      assignTrackedModelMock(
        trackedModelCalls,
        modelName,
        'deleteMany',
        makeDeleteMany()
      )
    }

    prisma.extractIntegrationItem.deleteMany = makeDeleteMany()
    prisma.$executeRaw = jest.fn().mockResolvedValue(1)

    prisma.user.findUnique.mockResolvedValue(mockUser)
    deleteCustomer.mockResolvedValue(true)
    notifyUserDeleted.mockResolvedValue(undefined)
  })

  describe('user scoping - every operation must be locked to the target userId', () => {
    it('should look up the user by the provided userId', async () => {
      await deleteUser(USER_ID)

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } })
      )
    })

    it('should delete the user record by the target userId using raw SQL', async () => {
      await deleteUser(USER_ID)

      expect(prisma.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('DELETE FROM')]),
        USER_ID
      )

      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it.each(userDeleteHelperHandledModels.map(toPrismaDelegateName))(
      'should paginate %s only for the target user',
      async (model) => {
        await deleteUser(USER_ID)

        expect(prisma[model].paginate).toHaveBeenCalled()

        for (const args of prisma[model].paginate.calls) {
          expect(args.where.userId).toBe(USER_ID)
        }
      }
    )

    it.each(userDeleteDirectDeleteManyModels.map(toPrismaDelegateName))(
      'should deleteMany %s only for the target user',
      async (model) => {
        await deleteUser(USER_ID)

        expect(prisma[model].deleteMany).toHaveBeenCalled()

        for (const [args] of prisma[model].deleteMany.mock.calls) {
          expect(args.where.userId).toBe(USER_ID)
        }
      }
    )

    it('should scope every non-excluded direct user-owned model access to the target user', async () => {
      await deleteUser(USER_ID)

      for (const modelName of directUserOwnedModels) {
        if (userDeleteCoverageExcludedModels.includes(modelName)) {
          continue
        }

        const trackedEntry = trackedModelCalls.get(modelName)

        for (const args of trackedEntry?.paginate?.calls || []) {
          expect(args.where.userId).toBe(USER_ID)
        }

        for (const [args] of trackedEntry?.deleteMany?.mock?.calls || []) {
          expect(args.where.userId).toBe(USER_ID)
        }
      }
    })
  })

  describe('schema guard', () => {
    it('should only exclude models that are directly owned by userId', () => {
      expect(
        userDeleteCoverageExcludedModels.every((modelName) =>
          directUserOwnedModels.includes(modelName)
        )
      ).toBe(true)
    })

    it('should touch every non-retained direct user-owned model during deleteUser', async () => {
      await deleteUser(USER_ID)

      const excludedModels = new Set(userDeleteCoverageExcludedModels)
      const missingModels = directUserOwnedModels.filter((modelName) => {
        if (excludedModels.has(modelName)) {
          return false
        }

        const trackedEntry = trackedModelCalls.get(modelName)

        return (
          !trackedEntry?.paginate?.calls?.length &&
          !trackedEntry?.deleteMany?.mock?.calls?.length
        )
      })

      expect(missingModels).toEqual([])
    })
  })

  describe('resource delegation', () => {
    it('should call deleteManyBots with bots belonging to the user', async () => {
      const bots = [{ id: 'bot-1' }, { id: 'bot-2' }]

      prisma.bot.paginate = makePaginate(bots)

      await deleteUser(USER_ID)

      expect(deleteManyBots).toHaveBeenCalled()

      // parallel workers split items across batch calls - assert all ids appear across calls
      const allReceived = deleteManyBots.mock.calls.flat(2)

      expect(allReceived).toEqual(expect.arrayContaining(bots))
    })

    it('should call deleteDataset for each dataset belonging to the user', async () => {
      const datasets = [{ id: 'ds-1' }, { id: 'ds-2' }]

      prisma.dataset.paginate = makePaginate(datasets)

      await deleteUser(USER_ID)

      expect(deleteDataset).toHaveBeenCalledTimes(2)
      expect(deleteDataset).toHaveBeenCalledWith({ id: 'ds-1' })
      expect(deleteDataset).toHaveBeenCalledWith({ id: 'ds-2' })
    })

    it('should call deleteManySkillsets with skillsets belonging to the user', async () => {
      const skillsets = [{ id: 'ss-1' }, { id: 'ss-2' }]

      prisma.skillset.paginate = makePaginate(skillsets)

      await deleteUser(USER_ID)

      expect(deleteManySkillsets).toHaveBeenCalled()

      const allReceived = deleteManySkillsets.mock.calls.flat(2)

      expect(allReceived).toEqual(expect.arrayContaining(skillsets))
    })

    it('should call deleteFile for each file belonging to the user', async () => {
      const files = [{ id: 'f-1' }, { id: 'f-2' }]

      prisma.file.paginate = makePaginate(files)

      await deleteUser(USER_ID)

      expect(deleteFile).toHaveBeenCalledTimes(2)
      expect(deleteFile).toHaveBeenCalledWith({ id: 'f-1' })
      expect(deleteFile).toHaveBeenCalledWith({ id: 'f-2' })
    })

    it('should call deleteManySpaces with spaces belonging to the user', async () => {
      const spaces = [{ id: 'sp-1' }, { id: 'sp-2' }]

      prisma.space.paginate = makePaginate(spaces)

      await deleteUser(USER_ID)

      expect(deleteManySpaces).toHaveBeenCalled()

      const allReceived = deleteManySpaces.mock.calls.flat(2)

      expect(allReceived).toEqual(expect.arrayContaining(spaces))
    })

    it('should call deleteConversation for each conversation belonging to the user', async () => {
      const conversations = [{ id: 'conv-1' }, { id: 'conv-2' }]

      prisma.conversation.paginate = makePaginate(conversations)

      await deleteUser(USER_ID)

      expect(deleteConversation).toHaveBeenCalledTimes(2)
      expect(deleteConversation).toHaveBeenCalledWith('conv-1')
      expect(deleteConversation).toHaveBeenCalledWith('conv-2')
    })

    it('should call deleteBlueprint with deleteResources for each blueprint belonging to the user', async () => {
      const blueprints = [
        { id: 'bp-1', userId: USER_ID },
        { id: 'bp-2', userId: USER_ID },
      ]

      prisma.blueprint.paginate = makePaginate(blueprints)

      await deleteUser(USER_ID)

      expect(deleteBlueprint).toHaveBeenCalledTimes(2)
      expect(deleteBlueprint).toHaveBeenCalledWith(
        { id: 'bp-1', userId: USER_ID },
        { deleteResources: true }
      )
      expect(deleteBlueprint).toHaveBeenCalledWith(
        { id: 'bp-2', userId: USER_ID },
        { deleteResources: true }
      )
    })
  })

  describe('ordering guarantees', () => {
    it('should delete blueprints after conversations', async () => {
      const order = []

      prisma.conversation.paginate = makePaginate([{ id: 'conv-1' }])
      deleteConversation.mockImplementation(async () => {
        order.push('conversation')
      })

      prisma.blueprint.paginate = makePaginate([
        { id: 'bp-1', userId: USER_ID },
      ])
      deleteBlueprint.mockImplementation(async () => {
        order.push('blueprint')
      })

      await deleteUser(USER_ID)

      expect(order.indexOf('conversation')).toBeLessThan(
        order.indexOf('blueprint')
      )
    })

    it('should delete contacts after conversations', async () => {
      const order = []

      prisma.conversation.paginate = makePaginate([{ id: 'conv-1' }])
      deleteConversation.mockImplementation(async () => {
        order.push('conversation')
      })

      prisma.contact.deleteMany = jest.fn().mockImplementation(async () => {
        order.push('contact')

        return { count: 0 }
      })

      await deleteUser(USER_ID)

      expect(order.indexOf('conversation')).toBeLessThan(
        order.indexOf('contact')
      )
    })

    it('should delete tasks before contacts', async () => {
      const order = []

      prisma.task.deleteMany = jest.fn().mockImplementation(async () => {
        order.push('task')

        return { count: 0 }
      })

      prisma.contact.deleteMany = jest.fn().mockImplementation(async () => {
        order.push('contact')

        return { count: 0 }
      })

      await deleteUser(USER_ID)

      expect(order.indexOf('task')).toBeLessThan(order.indexOf('contact'))
    })

    it('should delete taskExecutions before tasks', async () => {
      const order = []

      prisma.taskExecution.deleteMany = jest
        .fn()
        .mockImplementation(async () => {
          order.push('taskExecution')

          return { count: 0 }
        })

      prisma.task.deleteMany = jest.fn().mockImplementation(async () => {
        order.push('task')

        return { count: 0 }
      })

      await deleteUser(USER_ID)

      expect(order.indexOf('taskExecution')).toBeLessThan(order.indexOf('task'))
    })
  })

  describe('error handling', () => {
    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(deleteUser(USER_ID)).rejects.toThrow()

      expect(throwNotFound).toHaveBeenCalled()
      expect(prisma.$executeRaw).not.toHaveBeenCalled()
    })

    it('should handle notification errors gracefully', async () => {
      const err = new Error('Notification error')

      notifyUserDeleted.mockRejectedValue(err)

      await deleteUser(USER_ID)

      expect(captureError).toHaveBeenCalledWith(err)
    })

    it('should not send deletion email when disabled', async () => {
      await deleteUser(USER_ID, { sendDeletionEmail: false })

      expect(notifyUserDeleted).not.toHaveBeenCalled()
      expect(captureError).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Notification error' })
      )
    })

    it('should stop before deleting the user if billing customer deletion fails', async () => {
      const err = new Error('billing provider error')

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        billingCustomerId: 'cus_123',
      })
      deleteCustomer.mockRejectedValue(err)

      await expect(
        deleteUser(USER_ID, { deleteBillingCustomer: true })
      ).rejects.toThrow('billing provider error')

      expect(prisma.$executeRaw).not.toHaveBeenCalled()
    })
  })

  describe('billing customer cleanup', () => {
    it('should not delete the billing customer by default', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        billingCustomerId: 'cus_123',
      })

      await deleteUser(USER_ID)

      expect(deleteCustomer).not.toHaveBeenCalled()
      expect(prisma.$executeRaw).toHaveBeenCalled()
    })

    it('should delete the billing customer before deleting the user when enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        billingCustomerId: 'cus_123',
      })

      await deleteUser(USER_ID, { deleteBillingCustomer: true })

      expect(deleteCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ billingCustomerId: 'cus_123' })
      )
      expect(prisma.$executeRaw).toHaveBeenCalled()
    })
  })

  describe('deletion email', () => {
    it('should send deletion email by default', async () => {
      await deleteUser(USER_ID)

      expect(notifyUserDeleted).toHaveBeenCalledWith(mockUser)
    })
  })
})
