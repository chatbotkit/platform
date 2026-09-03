/* eslint-disable @typescript-eslint/no-require-imports */
import { getItems } from '@/lib/hub'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    hubBotPage: {
      findMany: jest.fn(),
    },
    hubDatasetPage: {
      findMany: jest.fn(),
    },
    hubSkillsetPage: {
      findMany: jest.fn(),
    },
    hubWidgetPage: {
      findMany: jest.fn(),
    },
    hubBlueprintPage: {
      findMany: jest.fn(),
    },
  },
}))

const prisma = require('@/prisma/client').default

describe('getItems', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should fetch and combine all hub items', async () => {
      const mockBot = {
        id: 'bot1',
        name: 'Test Bot',
        description: 'A test bot',
        slug: 'test-bot',
        icon: 'robot',
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: 'User1', image: 'avatar1.png' },
      }

      const mockDataset = {
        id: 'dataset1',
        name: 'Test Dataset',
        description: 'A test dataset',
        slug: 'test-dataset',
        icon: 'database',
        rank: 900,
        createdAt: new Date('2024-01-02'),
        user: { name: 'User2', image: 'avatar2.png' },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([mockBot])
      prisma.hubDatasetPage.findMany.mockResolvedValue([mockDataset])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ ...mockBot, type: 'bot' })
      expect(result[1]).toEqual({ ...mockDataset, type: 'dataset' })
    })

    it('should call all hub page queries', async () => {
      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      await getItems()

      expect(prisma.hubBotPage.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.hubDatasetPage.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.hubSkillsetPage.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.hubWidgetPage.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.hubBlueprintPage.findMany).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no items exist', async () => {
      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result).toEqual([])
    })
  })

  describe('sorting behavior', () => {
    it('should sort by rank descending', async () => {
      const bot1 = {
        id: 'bot1',
        name: 'Bot 1',
        description: 'desc',
        slug: 'bot1',
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      const bot2 = {
        id: 'bot2',
        name: 'Bot 2',
        description: 'desc',
        slug: 'bot2',
        icon: null,
        rank: 2000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([bot1, bot2])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].rank).toBe(2000)
      expect(result[1].rank).toBe(1000)
    })

    it('should sort by createdAt when ranks are equal', async () => {
      const bot1 = {
        id: 'bot1',
        name: 'Bot 1',
        description: 'desc',
        slug: 'bot1',
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      const bot2 = {
        id: 'bot2',
        name: 'Bot 2',
        description: 'desc',
        slug: 'bot2',
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-02'),
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([bot1, bot2])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].id).toBe('bot2')
      expect(result[1].id).toBe('bot1')
    })

    it('should sort by id when rank and createdAt are equal', async () => {
      const createdDate = new Date('2024-01-01')

      const bot1 = {
        id: 'aaa',
        name: 'Bot 1',
        description: 'desc',
        slug: 'bot1',
        icon: null,
        rank: 1000,
        createdAt: createdDate,
        user: { name: null, image: null },
      }

      const bot2 = {
        id: 'zzz',
        name: 'Bot 2',
        description: 'desc',
        slug: 'bot2',
        icon: null,
        rank: 1000,
        createdAt: createdDate,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([bot1, bot2])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].id).toBe('zzz')
      expect(result[1].id).toBe('aaa')
    })
  })

  describe('type assignment', () => {
    it('should assign correct type to bots', async () => {
      const mockBot = {
        id: 'bot1',
        name: 'Bot',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([mockBot])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].type).toBe('bot')
    })

    it('should assign correct type to datasets', async () => {
      const mockDataset = {
        id: 'dataset1',
        name: 'Dataset',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([mockDataset])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].type).toBe('dataset')
    })

    it('should assign correct type to skillsets', async () => {
      const mockSkillset = {
        id: 'skillset1',
        name: 'Skillset',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([mockSkillset])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].type).toBe('skillset')
    })

    it('should assign correct type to widgets', async () => {
      const mockWidget = {
        id: 'widget1',
        name: 'Widget',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([mockWidget])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].type).toBe('widget')
    })

    it('should assign correct type to blueprints', async () => {
      const mockBlueprint = {
        id: 'blueprint1',
        name: 'Blueprint',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([mockBlueprint])

      const result = await getItems()

      expect(result[0].type).toBe('blueprint')
    })

    it('should handle mixed types correctly', async () => {
      const mockBot = {
        id: 'bot1',
        name: 'Bot',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      const mockDataset = {
        id: 'dataset1',
        name: 'Dataset',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 900,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      const mockSkillset = {
        id: 'skillset1',
        name: 'Skillset',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 800,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([mockBot])
      prisma.hubDatasetPage.findMany.mockResolvedValue([mockDataset])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([mockSkillset])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('bot')
      expect(result[1].type).toBe('dataset')
      expect(result[2].type).toBe('skillset')
    })
  })

  describe('edge cases', () => {
    it('should handle null rank values', async () => {
      const bot1 = {
        id: 'bot1',
        name: 'Bot 1',
        description: 'desc',
        slug: null,
        icon: null,
        rank: null,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      const bot2 = {
        id: 'bot2',
        name: 'Bot 2',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([bot1, bot2])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].rank).toBe(1000)
      expect(result[1].rank).toBeNull()
    })

    it('should handle null createdAt values', async () => {
      const bot1 = {
        id: 'bot1',
        name: 'Bot 1',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 1000,
        createdAt: null,
        user: { name: null, image: null },
      }

      const bot2 = {
        id: 'bot2',
        name: 'Bot 2',
        description: 'desc',
        slug: null,
        icon: null,
        rank: 1000,
        createdAt: new Date('2024-01-01'),
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([bot1, bot2])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result).toHaveLength(2)
    })

    it('should handle null user name and image', async () => {
      const mockBot = {
        id: 'bot1',
        name: 'Bot',
        description: 'desc',
        slug: null,
        icon: null,
        user: { name: null, image: null },
      }

      prisma.hubBotPage.findMany.mockResolvedValue([mockBot])
      prisma.hubDatasetPage.findMany.mockResolvedValue([])
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      const result = await getItems()

      expect(result[0].user.name).toBeNull()
      expect(result[0].user.image).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should propagate prisma errors', async () => {
      const error = new Error('Database connection failed')

      prisma.hubBotPage.findMany.mockRejectedValue(error)

      await expect(getItems()).rejects.toThrow('Database connection failed')
    })

    it('should handle partial failures in Promise.all', async () => {
      prisma.hubBotPage.findMany.mockResolvedValue([])
      prisma.hubDatasetPage.findMany.mockRejectedValue(
        new Error('Dataset query failed')
      )
      prisma.hubSkillsetPage.findMany.mockResolvedValue([])
      prisma.hubWidgetPage.findMany.mockResolvedValue([])
      prisma.hubBlueprintPage.findMany.mockResolvedValue([])

      await expect(getItems()).rejects.toThrow('Dataset query failed')
    })
  })
})
