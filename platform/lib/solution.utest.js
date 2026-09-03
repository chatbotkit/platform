/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  withBlueprintResources,
  withBotResources,
  withDatasetResources,
  withDiscordIntegrationResources,
  withEmailIntegrationResources,
  withExtractIntegrationResources,
  withFileResources,
  withIntegrationResources,
  withMessengerIntegrationResources,
  withNotionIntegrationResources,
  withSecretResources,
  withSitemapIntegrationResources,
  withSkillsetResources,
  withSlackIntegrationResources,
  withSupportIntegrationResources,
  withTelegramIntegrationResources,
  withTriggerIntegrationResources,
  withWhatsappIntegrationResources,
  withWidgetIntegrationResources,
} from './solution'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

describe('solution', () => {
  const userId = 'user123'

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('withBotResources', () => {
    it('should return bot resource structure with defaults', () => {
      const result = withBotResources(userId)

      expect(result).toHaveProperty('dataset')
      expect(result).toHaveProperty('skillset')
      expect(result).toHaveProperty('widgetIntegrations')
      expect(result).toHaveProperty('slackIntegrations')
      expect(result).toHaveProperty('microsoftteamsIntegrations')
      expect(result).not.toHaveProperty('teamsIntegrations')
    })

    it('should respect depth limits', () => {
      const result = withBotResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })

    it('should skip integrations when requested', () => {
      const result = withBotResources(userId, { skipIntegrations: true })

      expect(result).toHaveProperty('dataset')
      expect(result).toHaveProperty('skillset')
      expect(result).not.toHaveProperty('widgetIntegrations')
    })

    it('should include userId in where clause for integrations', () => {
      const result = withBotResources(userId)

      expect(result.widgetIntegrations.where).toEqual({ userId })
      expect(result.slackIntegrations.where).toEqual({ userId })
      expect(result.microsoftteamsIntegrations.where).toEqual({ userId })
    })
  })

  describe('withDatasetResources', () => {
    it('should return dataset resource structure', () => {
      const result = withDatasetResources(userId)

      expect(result).toHaveProperty('bots')
      expect(result).toHaveProperty('sitemapIntegrations')
      expect(result).toHaveProperty('notionIntegrations')
    })

    it('should skip bots when requested', () => {
      const result = withDatasetResources(userId, { skipBots: true })

      expect(result).not.toHaveProperty('bots')
      expect(result).toHaveProperty('sitemapIntegrations')
    })

    it('should include sync fields for sitemap and notion', () => {
      const result = withDatasetResources(userId)

      expect(result.sitemapIntegrations.select).toHaveProperty('syncStatus')
      expect(result.sitemapIntegrations.select).toHaveProperty('syncSchedule')
      expect(result.sitemapIntegrations.select).toHaveProperty('lastSyncedAt')

      expect(result.notionIntegrations.select).toHaveProperty('syncStatus')
    })

    it('should respect max depth', () => {
      const result = withDatasetResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })
  })

  describe('withSkillsetResources', () => {
    it('should return skillset resource structure', () => {
      const result = withSkillsetResources(userId)

      expect(result).toHaveProperty('bots')
      expect(result).toHaveProperty('mcpserverIntegrations')
    })

    it('should skip bots when requested', () => {
      const result = withSkillsetResources(userId, { skipBots: true })

      expect(result).not.toHaveProperty('bots')
    })

    it('should respect depth limits', () => {
      const result = withSkillsetResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })
  })

  describe('withFileResources', () => {
    it('should return file resource structure', () => {
      const result = withFileResources(userId)

      expect(result).toHaveProperty('datasets')
    })

    it('should skip datasets when requested', () => {
      const result = withFileResources(userId, { skipDatasets: true })

      expect(result).not.toHaveProperty('datasets')
    })

    it('should respect depth limits', () => {
      const result = withFileResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })
  })

  describe('withSecretResources', () => {
    it('should return empty object by default', () => {
      const result = withSecretResources(userId)

      expect(result).toEqual({})
    })

    it('should respect depth limits', () => {
      const result = withSecretResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })
  })

  describe('withIntegrationResources', () => {
    it('should return widget integration resources', () => {
      const result = withIntegrationResources(userId, 'widget')

      expect(result).toHaveProperty('bot')
    })

    it('should return slack integration resources', () => {
      const result = withIntegrationResources(userId, 'slack')

      expect(result).toEqual({})
    })

    it('should return sitemap integration resources', () => {
      const result = withIntegrationResources(userId, 'sitemap')

      expect(result).toHaveProperty('dataset')
    })

    it('should return notion integration resources', () => {
      const result = withIntegrationResources(userId, 'notion')

      expect(result).toHaveProperty('dataset')
    })

    it('should return empty object for unknown type', () => {
      const result = withIntegrationResources(userId, 'unknown')

      expect(result).toEqual({})
    })

    it('should return empty when skipIntegrations is true', () => {
      const result = withIntegrationResources(userId, 'widget', {
        skipIntegrations: true,
      })

      expect(result).toEqual({})
    })

    it('should respect depth limits', () => {
      const result = withIntegrationResources(userId, 'widget', {
        depth: 2,
        maxDepth: 2,
      })

      expect(result).toEqual({})
    })
  })

  describe('withWidgetIntegrationResources', () => {
    it('should return widget bot reference', () => {
      const result = withWidgetIntegrationResources(userId)

      expect(result).toHaveProperty('bot')
      expect(result.bot).toHaveProperty('select')
    })

    it('should skip when skipWidgetIntegration is true', () => {
      const result = withWidgetIntegrationResources(userId, {
        skipWidgetIntegration: true,
      })

      expect(result).toEqual({})
    })

    it('should respect depth limits', () => {
      const result = withWidgetIntegrationResources(userId, {
        depth: 2,
        maxDepth: 2,
      })

      expect(result).toEqual({})
    })
  })

  describe('withSlackIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withSlackIntegrationResources(userId)

      expect(result).toEqual({})
    })

    it('should skip when skipSlackIntegration is true', () => {
      const result = withSlackIntegrationResources(userId, {
        skipSlackIntegration: true,
      })

      expect(result).toEqual({})
    })
  })

  describe('withDiscordIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withDiscordIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withWhatsappIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withWhatsappIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withMessengerIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withMessengerIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withTelegramIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withTelegramIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withEmailIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withEmailIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withTriggerIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withTriggerIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withSupportIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withSupportIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withExtractIntegrationResources', () => {
    it('should return empty object', () => {
      const result = withExtractIntegrationResources(userId)

      expect(result).toEqual({})
    })
  })

  describe('withSitemapIntegrationResources', () => {
    it('should return dataset reference', () => {
      const result = withSitemapIntegrationResources(userId)

      expect(result).toHaveProperty('dataset')
      expect(result.dataset).toHaveProperty('select')
    })

    it('should skip when skipSitemapIntegration is true', () => {
      const result = withSitemapIntegrationResources(userId, {
        skipSitemapIntegration: true,
      })

      expect(result).toEqual({})
    })
  })

  describe('withNotionIntegrationResources', () => {
    it('should return dataset reference', () => {
      const result = withNotionIntegrationResources(userId)

      expect(result).toHaveProperty('dataset')
      expect(result.dataset).toHaveProperty('select')
    })

    it('should skip when skipNotionIntegration is true', () => {
      const result = withNotionIntegrationResources(userId, {
        skipNotionIntegration: true,
      })

      expect(result).toEqual({})
    })
  })

  describe('withBlueprintResources', () => {
    it('should return empty object by default', () => {
      const result = withBlueprintResources(userId)

      expect(result).toEqual({})
    })

    it('should skip when skipBlueprint is true', () => {
      const result = withBlueprintResources(userId, { skipBlueprint: true })

      expect(result).toEqual({})
    })

    it('should respect depth limits', () => {
      const result = withBlueprintResources(userId, { depth: 2, maxDepth: 2 })

      expect(result).toEqual({})
    })
  })

  describe('depth and recursion', () => {
    it('should increment depth when calling nested resources', () => {
      const result = withBotResources(userId, { depth: 0, maxDepth: 3 })

      expect(result.dataset.select).toBeDefined()
    })

    it('should stop at maxDepth', () => {
      const result = withBotResources(userId, { depth: 0, maxDepth: 1 })

      expect(result.dataset.select).toBeDefined()

      const datasetSelect = result.dataset.select

      expect(datasetSelect.bots).toBeUndefined()
    })

    it('should handle default maxDepth of 2', () => {
      const result = withBotResources(userId)

      expect(result.dataset).toBeDefined()
      expect(result.dataset.select).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined options', () => {
      const result = withBotResources(userId, undefined)

      expect(result).toHaveProperty('dataset')
    })

    it('should handle empty options object', () => {
      const result = withBotResources(userId, {})

      expect(result).toHaveProperty('dataset')
    })

    it('should handle custom maxDepth', () => {
      const result = withBotResources(userId, { maxDepth: 5 })

      expect(result).toHaveProperty('dataset')
    })
  })
})
