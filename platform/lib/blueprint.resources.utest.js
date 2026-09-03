/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  getBlueprintAndCloneableResources,
  getSelectForType,
} from './blueprint.resources'

import { z } from 'zod'

jest.mock('@/prisma/client', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/schemas/api/v1/ability', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/anamIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/avatarIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/bot', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/dataset', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/skillset', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/secret', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/file', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/portal', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/discordIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/emailIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/extractIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/mcpserverIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/messengerIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/notionIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/recallIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/sitemapIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/slackIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/supportIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/telegramIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/triggerIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/twilioIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/whatsappIntegration', () => ({
  blueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

jest.mock('@/schemas/api/v1/widgetIntegration', () => ({
  cloneableBlueprintSchema: jest
    .requireActual('zod')
    .z.object({ id: jest.requireActual('zod').z.string() }),
}))

describe('getSelectForType', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create select object from Zod schema', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
      })

      const result = getSelectForType(schema)

      expect(result).toEqual({
        select: {
          id: true,
          name: true,
          description: true,
        },
      })
    })

    it('should handle schema with single field', () => {
      const schema = z.object({
        id: z.string(),
      })

      const result = getSelectForType(schema)

      expect(result).toEqual({
        select: {
          id: true,
        },
      })
    })

    it('should handle schema with many fields', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        userId: z.string(),
        meta: z.any(),
      })

      const result = getSelectForType(schema)

      expect(result).toEqual({
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          meta: true,
        },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const schema = z.object({})

      const result = getSelectForType(schema)

      expect(result).toEqual({
        select: {},
      })
    })

    it('should handle schema with optional fields', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable(),
      })

      const result = getSelectForType(schema)

      expect(result).toEqual({
        select: {
          id: true,
          name: true,
          description: true,
        },
      })
    })
  })
})

describe('getBlueprintAndCloneableResources', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should fetch blueprint with all resources', async () => {
      const mockBlueprint = {
        id: 'blueprint-1',
        name: 'Test Blueprint',
        bots: [{ id: 'bot-1', name: 'Test Bot' }],
        datasets: [{ id: 'dataset-1', name: 'Test Dataset' }],
        skillsets: [],
        abilities: [],
        secrets: [],
        files: [],
        portals: [],
        policies: [],
        spaces: [],
        extractIntegrations: [],
        notionIntegrations: [],
        sitemapIntegrations: [],
        supportIntegrations: [],
        emailIntegrations: [],
        triggerIntegrations: [],
        widgetIntegrations: [],
        slackIntegrations: [],
        discordIntegrations: [],
        telegramIntegrations: [],
        whatsappIntegrations: [],
        messengerIntegrations: [],
        instagramIntegrations: [],
        twilioIntegrations: [],
        avatarIntegrations: [],
        anamIntegrations: [],
        recallIntegrations: [],
        mcpserverIntegrations: [],
        microsoftteamsIntegrations: [],
        googlechatIntegrations: [],
        oAuthConnections: [],
        hubBlueprintPage: null,
      }

      prisma.blueprint.findUnique.mockResolvedValue(mockBlueprint)

      const result = await getBlueprintAndCloneableResources('blueprint-1')

      expect(prisma.blueprint.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'blueprint-1',
        },
        include: expect.objectContaining({
          hubBlueprintPage: true,
          bots: expect.any(Object),
          datasets: expect.any(Object),
          skillsets: expect.any(Object),
        }),
      })

      expect(result).toEqual({
        blueprint: mockBlueprint,
        resources: {
          basic: {
            bot: mockBlueprint.bots,
            dataset: mockBlueprint.datasets,
            skillset: mockBlueprint.skillsets,
            ability: mockBlueprint.abilities,
            secret: mockBlueprint.secrets,
            file: mockBlueprint.files,
            portals: mockBlueprint.portals,
          },
          object: {
            space: mockBlueprint.spaces,
          },
          compliance: {
            policy: mockBlueprint.policies,
          },
          oauth: {
            oAuthConnection: mockBlueprint.oAuthConnections,
          },
          integration: {
            extract: mockBlueprint.extractIntegrations,
            notion: mockBlueprint.notionIntegrations,
            sitemap: mockBlueprint.sitemapIntegrations,
            support: mockBlueprint.supportIntegrations,
            email: mockBlueprint.emailIntegrations,
            trigger: mockBlueprint.triggerIntegrations,
            widget: mockBlueprint.widgetIntegrations,
            slack: mockBlueprint.slackIntegrations,
            discord: mockBlueprint.discordIntegrations,
            microsoftteams: mockBlueprint.microsoftteamsIntegrations,
            googlechat: mockBlueprint.googlechatIntegrations,
            telegram: mockBlueprint.telegramIntegrations,
            whatsapp: mockBlueprint.whatsappIntegrations,
            messenger: mockBlueprint.messengerIntegrations,
            instagram: mockBlueprint.instagramIntegrations,
            twilio: mockBlueprint.twilioIntegrations,
            avatar: mockBlueprint.avatarIntegrations,
            anam: mockBlueprint.anamIntegrations,
            recall: mockBlueprint.recallIntegrations,
            mcpserver: mockBlueprint.mcpserverIntegrations,
          },
        },
      })
    })

    it('should organize basic resources correctly', async () => {
      const mockBlueprint = {
        id: 'blueprint-1',
        bots: [{ id: 'bot-1' }],
        datasets: [{ id: 'dataset-1' }],
        skillsets: [{ id: 'skillset-1' }],
        abilities: [{ id: 'ability-1' }],
        secrets: [{ id: 'secret-1' }],
        files: [{ id: 'file-1' }],
        portals: [{ id: 'portal-1' }],
        spaces: [],
        extractIntegrations: [],
        notionIntegrations: [],
        sitemapIntegrations: [],
        supportIntegrations: [],
        emailIntegrations: [],
        triggerIntegrations: [],
        widgetIntegrations: [],
        slackIntegrations: [],
        discordIntegrations: [],
        telegramIntegrations: [],
        whatsappIntegrations: [],
        messengerIntegrations: [],
        twilioIntegrations: [],
        avatarIntegrations: [],
        anamIntegrations: [],
        recallIntegrations: [],
        mcpserverIntegrations: [],
        hubBlueprintPage: null,
      }

      prisma.blueprint.findUnique.mockResolvedValue(mockBlueprint)

      const result = await getBlueprintAndCloneableResources('blueprint-1')

      expect(result.resources.basic.bot).toEqual([{ id: 'bot-1' }])
      expect(result.resources.basic.dataset).toEqual([{ id: 'dataset-1' }])
      expect(result.resources.basic.skillset).toEqual([{ id: 'skillset-1' }])
      expect(result.resources.basic.ability).toEqual([{ id: 'ability-1' }])
      expect(result.resources.basic.secret).toEqual([{ id: 'secret-1' }])
      expect(result.resources.basic.file).toEqual([{ id: 'file-1' }])
      expect(result.resources.basic.portals).toEqual([{ id: 'portal-1' }])
    })

    it('should organize integration resources correctly', async () => {
      const mockBlueprint = {
        id: 'blueprint-1',
        bots: [],
        datasets: [],
        skillsets: [],
        abilities: [],
        secrets: [],
        files: [],
        portals: [],
        policies: [],
        spaces: [],
        extractIntegrations: [{ id: 'extract-1' }],
        notionIntegrations: [{ id: 'notion-1' }],
        sitemapIntegrations: [{ id: 'sitemap-1' }],
        supportIntegrations: [{ id: 'support-1' }],
        emailIntegrations: [{ id: 'email-1' }],
        triggerIntegrations: [{ id: 'trigger-1' }],
        widgetIntegrations: [{ id: 'widget-1' }],
        slackIntegrations: [{ id: 'slack-1' }],
        discordIntegrations: [{ id: 'discord-1' }],
        telegramIntegrations: [{ id: 'telegram-1' }],
        whatsappIntegrations: [{ id: 'whatsapp-1' }],
        messengerIntegrations: [{ id: 'messenger-1' }],
        twilioIntegrations: [{ id: 'twilio-1' }],
        avatarIntegrations: [{ id: 'avatar-1' }],
        anamIntegrations: [{ id: 'anam-1' }],
        recallIntegrations: [{ id: 'recall-1' }],
        mcpserverIntegrations: [{ id: 'mcpserver-1' }],
        hubBlueprintPage: null,
      }

      prisma.blueprint.findUnique.mockResolvedValue(mockBlueprint)

      const result = await getBlueprintAndCloneableResources('blueprint-1')

      expect(result.resources.integration.extract).toEqual([
        { id: 'extract-1' },
      ])
      expect(result.resources.integration.notion).toEqual([{ id: 'notion-1' }])
      expect(result.resources.integration.sitemap).toEqual([
        { id: 'sitemap-1' },
      ])
      expect(result.resources.integration.slack).toEqual([{ id: 'slack-1' }])
      expect(result.resources.integration.mcpserver).toEqual([
        { id: 'mcpserver-1' },
      ])
      expect(result.resources.integration.avatar).toEqual([{ id: 'avatar-1' }])
      expect(result.resources.integration.anam).toEqual([{ id: 'anam-1' }])
      expect(result.resources.integration.recall).toEqual([{ id: 'recall-1' }])
    })
  })

  describe('edge cases', () => {
    it('should return null when blueprint not found', async () => {
      prisma.blueprint.findUnique.mockResolvedValue(null)

      const result = await getBlueprintAndCloneableResources('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle blueprint with all empty resource arrays', async () => {
      const mockBlueprint = {
        id: 'blueprint-1',
        bots: [],
        datasets: [],
        skillsets: [],
        abilities: [],
        secrets: [],
        files: [],
        portals: [],
        policies: [],
        spaces: [],
        extractIntegrations: [],
        notionIntegrations: [],
        sitemapIntegrations: [],
        supportIntegrations: [],
        emailIntegrations: [],
        triggerIntegrations: [],
        widgetIntegrations: [],
        slackIntegrations: [],
        discordIntegrations: [],
        telegramIntegrations: [],
        whatsappIntegrations: [],
        messengerIntegrations: [],
        instagramIntegrations: [],
        twilioIntegrations: [],
        avatarIntegrations: [],
        anamIntegrations: [],
        recallIntegrations: [],
        mcpserverIntegrations: [],
        microsoftteamsIntegrations: [],
        googlechatIntegrations: [],
        oAuthConnections: [],
        hubBlueprintPage: null,
      }

      prisma.blueprint.findUnique.mockResolvedValue(mockBlueprint)

      const result = await getBlueprintAndCloneableResources('blueprint-1')

      expect(result).toEqual({
        blueprint: mockBlueprint,
        resources: {
          basic: {
            bot: [],
            dataset: [],
            skillset: [],
            ability: [],
            secret: [],
            file: [],
            portals: [],
          },
          object: {
            space: [],
          },
          compliance: {
            policy: [],
          },
          oauth: {
            oAuthConnection: [],
          },
          integration: {
            extract: [],
            notion: [],
            sitemap: [],
            support: [],
            email: [],
            trigger: [],
            widget: [],
            slack: [],
            discord: [],
            microsoftteams: [],
            googlechat: [],
            telegram: [],
            whatsapp: [],
            messenger: [],
            instagram: [],
            twilio: [],
            avatar: [],
            anam: [],
            recall: [],
            mcpserver: [],
          },
        },
      })
    })

    it('should handle blueprint with hubBlueprintPage', async () => {
      const mockBlueprint = {
        id: 'blueprint-1',
        bots: [],
        datasets: [],
        skillsets: [],
        abilities: [],
        secrets: [],
        files: [],
        portals: [],
        policies: [],
        spaces: [],
        extractIntegrations: [],
        notionIntegrations: [],
        sitemapIntegrations: [],
        supportIntegrations: [],
        emailIntegrations: [],
        triggerIntegrations: [],
        widgetIntegrations: [],
        slackIntegrations: [],
        discordIntegrations: [],
        telegramIntegrations: [],
        whatsappIntegrations: [],
        messengerIntegrations: [],
        twilioIntegrations: [],
        avatarIntegrations: [],
        anamIntegrations: [],
        recallIntegrations: [],
        mcpserverIntegrations: [],
        hubBlueprintPage: {
          id: 'page-1',
          title: 'Test Page',
        },
      }

      prisma.blueprint.findUnique.mockResolvedValue(mockBlueprint)

      const result = await getBlueprintAndCloneableResources('blueprint-1')

      expect(result.blueprint.hubBlueprintPage).toEqual({
        id: 'page-1',
        title: 'Test Page',
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.blueprint.findUnique.mockRejectedValue(dbError)

      await expect(
        getBlueprintAndCloneableResources('blueprint-1')
      ).rejects.toThrow('Database connection failed')
    })
  })
})
