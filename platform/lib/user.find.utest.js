/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { findUser } from './user.find'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

describe('findUser', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('user@ prefix', () => {
    it('should find user by user ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await findUser('user@user123')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
      })
    })

    it('should handle whitespace in identifier', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)

      await findUser(' user@user123 ')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
      })
    })
  })

  describe('bot@ prefix', () => {
    it('should find user by bot ID', async () => {
      prisma.bot.findUnique.mockResolvedValue({
        id: 'bot123',
        user: mockUser,
      })

      const result = await findUser('bot@bot123')

      expect(result).toEqual(mockUser)
      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: { id: 'bot123' },
        include: { user: true },
      })
    })

    it('should return undefined if bot not found', async () => {
      prisma.bot.findUnique.mockResolvedValue(null)

      const result = await findUser('bot@nonexistent')

      expect(result).toBeUndefined()
    })
  })

  describe('dataset@ prefix', () => {
    it('should find user by dataset ID', async () => {
      prisma.dataset.findUnique.mockResolvedValue({
        id: 'dataset123',
        user: mockUser,
      })

      const result = await findUser('dataset@dataset123')

      expect(result).toEqual(mockUser)
      expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
        where: { id: 'dataset123' },
        include: { user: true },
      })
    })
  })

  describe('record@ prefix', () => {
    it('should throw error for record lookup since records are now in vector service', async () => {
      await expect(findUser('record@record123')).rejects.toThrow(
        'Record lookup by ID is no longer supported. Use dataset@ prefix instead.'
      )
    })
  })

  describe('skillset@ prefix', () => {
    it('should find user by skillset ID', async () => {
      prisma.skillset.findUnique.mockResolvedValue({
        id: 'skillset123',
        user: mockUser,
      })

      const result = await findUser('skillset@skillset123')

      expect(result).toEqual(mockUser)
      expect(prisma.skillset.findUnique).toHaveBeenCalledWith({
        where: { id: 'skillset123' },
        include: { user: true },
      })
    })
  })

  describe('ability@ prefix', () => {
    it('should find user by ability ID', async () => {
      prisma.ability.findUnique.mockResolvedValue({
        id: 'ability123',
        user: mockUser,
      })

      const result = await findUser('ability@ability123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('file@ prefix', () => {
    it('should find user by file ID', async () => {
      prisma.file.findUnique.mockResolvedValue({
        id: 'file123',
        user: mockUser,
      })

      const result = await findUser('file@file123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('secret@ prefix', () => {
    it('should find user by secret ID', async () => {
      prisma.secret.findUnique.mockResolvedValue({
        id: 'secret123',
        user: mockUser,
      })

      const result = await findUser('secret@secret123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('blueprint@ prefix', () => {
    it('should find user by blueprint ID', async () => {
      prisma.blueprint.findUnique.mockResolvedValue({
        id: 'blueprint123',
        user: mockUser,
      })

      const result = await findUser('blueprint@blueprint123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('portal@ prefix', () => {
    it('should find user by portal ID', async () => {
      prisma.portal.findUnique.mockResolvedValue({
        id: 'portal123',
        user: mockUser,
      })

      const result = await findUser('portal@portal123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('integration@ prefixes', () => {
    const integrationTypes = [
      'sitemapIntegration',
      'notionIntegration',
      'widgetIntegration',
      'slackIntegration',
      'discordIntegration',
      'whatsappIntegration',
      'messengerIntegration',
      'telegramIntegration',
      'emailIntegration',
      'triggerIntegration',
      'supportIntegration',
      'extractIntegration',
    ]

    integrationTypes.forEach((integrationType) => {
      it(`should find user by ${integrationType} ID`, async () => {
        prisma[integrationType].findUnique.mockResolvedValue({
          id: `${integrationType}123`,
          user: mockUser,
        })

        const result = await findUser(
          `${integrationType}@${integrationType}123`
        )

        expect(result).toEqual(mockUser)
        expect(prisma[integrationType].findUnique).toHaveBeenCalledWith({
          where: { id: `${integrationType}123` },
          include: { user: true },
        })
      })
    })
  })

  describe('contact@ prefix', () => {
    it('should find user by contact ID', async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: 'contact123',
        user: mockUser,
      })

      const result = await findUser('contact@contact123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('task@ prefix', () => {
    it('should find user by task ID', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task123',
        user: mockUser,
      })

      const result = await findUser('task@task123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('conversation@ prefix', () => {
    it('should find user by conversation ID', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conversation123',
        user: mockUser,
      })

      const result = await findUser('conversation@conversation123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('message@ prefix', () => {
    it('should find user by message ID', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'message123',
        conversation: {
          id: 'conversation123',
          user: mockUser,
        },
      })

      const result = await findUser('message@message123')

      expect(result).toEqual(mockUser)
      expect(prisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'message123' },
        include: {
          conversation: {
            include: { user: true },
          },
        },
      })
    })
  })

  describe('rating@ prefix', () => {
    it('should find user by rating ID', async () => {
      prisma.rating.findUnique.mockResolvedValue({
        id: 'rating123',
        user: mockUser,
      })

      const result = await findUser('rating@rating123')

      expect(result).toEqual(mockUser)
    })
  })

  describe('email identifier', () => {
    it('should find user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await findUser('test@example.com')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('should handle wildcard email search', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser)

      const result = await findUser('*@example.com')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            contains: '%@example.com',
          },
        },
      })
    })

    it('should replace multiple wildcards', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser)

      await findUser('test*@*.com')

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            contains: 'test%@%.com',
          },
        },
      })
    })
  })

  describe('direct user ID', () => {
    it('should find user by direct ID without prefix', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await findUser('user123')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle identifiers with extra spaces', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)

      await findUser('  user@user123  ')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
      })
    })

    it('should return undefined when resource not found', async () => {
      prisma.bot.findUnique.mockResolvedValue(null)

      const result = await findUser('bot@nonexistent')

      expect(result).toBeUndefined()
    })

    it('should return undefined when nested resource not found', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'message123',
        conversation: null,
      })

      const result = await findUser('message@message123')

      expect(result).toBeUndefined()
    })
  })
})
