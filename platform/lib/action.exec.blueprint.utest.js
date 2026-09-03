/* eslint-disable @typescript-eslint/no-require-imports */
import {
  doBlueprintBulletinCreate,
  doBlueprintBulletinList,
  doBlueprintMetaFetch,
  doBlueprintResourceList,
  executeBlueprintAction,
} from './action.exec.blueprint'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/blueprint.bulletin', () => ({
  createBlueprintBulletin: jest.fn(),
  listBlueprintBulletins: jest.fn(),
  BULLETIN_MAX_TEXT_LENGTH: 4000,
  BULLETIN_DEFAULT_TTL_SECONDS: 3600,
  BULLETIN_MAX_TTL_SECONDS: 86400,
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getUserClient: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/jsonpath', () => ({
  jsonpath: jest.fn(),
}))

jest.mock('@/lib/jmespath', () => ({
  jmespath: jest.fn(),
}))

jest.mock('@/prisma/client', () => ({
  blueprint: {
    findUnique: jest.fn(),
  },
}))

describe('action.exec.blueprint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('doBlueprintResourceList', () => {
    const mockGetConfigBySchema =
      require('@/lib/action.config').getConfigBySchema
    const mockGetUserClient = require('@/lib/cbk.sdk').getUserClient
    const mockGetContextBot = require('@/lib/context.store').getContextBot
    const mockLogEvent = require('@/lib/log').logEvent

    describe('basic functionality', () => {
      it('should list all blueprint resources', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {
            bot: [
              {
                id: 'bot-1',
                name: 'Test Bot',
                description: 'A test bot',
                meta: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            dataset: [
              {
                id: 'dataset-1',
                name: 'Test Dataset',
                description: 'A test dataset',
                meta: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({
          id: 'blueprint-123',
          resources: {
            bot: [
              {
                id: 'bot-1',
                name: 'Test Bot',
                description: 'A test bot',
                meta: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            dataset: [
              {
                id: 'dataset-1',
                name: 'Test Dataset',
                description: 'A test dataset',
                meta: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        })
        expect(mockListResources).toHaveBeenCalledWith('blueprint-123')
        expect(mockLogEvent).toHaveBeenCalled()
      })

      it('should filter resources by type', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'bot',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {
            bot: [
              {
                id: 'bot-1',
                name: 'Test Bot',
                description: 'A test bot',
              },
            ],
            dataset: [
              {
                id: 'dataset-1',
                name: 'Test Dataset',
                description: 'A test dataset',
              },
            ],
          },
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list bot resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({
          id: 'blueprint-123',
          resources: {
            bot: [
              {
                id: 'bot-1',
                name: 'Test Bot',
                description: 'A test bot',
              },
            ],
          },
        })
      })

      it('should exclude linked resources', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {
            bot: [
              {
                id: 'bot-1',
                name: 'Test Bot 1',
              },
              {
                id: 'bot-2',
                name: 'Test Bot 2',
              },
            ],
          },
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue({ id: 'bot-1' })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {
              skillsetId: 'skillset-1',
            },
          },
        })

        expect(result.error).toBeUndefined()
        expect(result.result.resources.bot).toHaveLength(1)
        expect(result.result.resources.bot[0].id).toBe('bot-2')
      })
    })

    describe('edge cases', () => {
      it('should handle missing blueprint ID', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: undefined,
          type: 'all',
        })

        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBe(
          'No blueprint ID found in context or parameters'
        )
        expect(result.result).toEqual([])
        expect(result.messages).toEqual([])
      })

      it('should handle empty resources', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {},
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({
          id: 'blueprint-123',
          resources: {},
        })
      })

      it('should handle non-existent resource type', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'ability',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {
            bot: [{ id: 'bot-1', name: 'Test Bot' }],
          },
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list ability resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBeUndefined()
        expect(result.result.resources).toEqual({
          ability: [],
        })
      })
    })

    describe('error handling', () => {
      it('should handle SDK errors gracefully', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        mockGetUserClient.mockRejectedValue(new Error('SDK connection failed'))

        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBe(
          'Failed to list blueprint resources: SDK connection failed'
        )
        expect(result.result).toEqual([])
        expect(result.messages).toEqual([])
      })

      it('should handle listResources API errors', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest
          .fn()
          .mockRejectedValue(new Error('Blueprint not found'))

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintResourceList({
          input: 'list resources',
          params: {},
          options: {
            userId: 'user-123',
            linkedResources: {},
          },
        })

        expect(result.error).toBe(
          'Failed to list blueprint resources: Blueprint not found'
        )
        expect(result.result).toEqual([])
      })
    })
  })

  describe('doBlueprintMetaFetch', () => {
    const mockGetConfigBySchema =
      require('@/lib/action.config').getConfigBySchema
    const mockLogEvent = require('@/lib/log').logEvent
    const mockFindUnique = require('@/prisma/client').blueprint.findUnique
    const mockJsonpath = require('@/lib/jsonpath').jsonpath
    const mockJmespath = require('@/lib/jmespath').jmespath

    describe('basic functionality', () => {
      it('should return the full meta object when no filter is given', async () => {
        const meta = { notes: { note1: { data: 'hello' } }, version: 2 }

        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: undefined,
          jmespath: undefined,
        })

        mockFindUnique.mockResolvedValue({ id: 'blueprint-123', meta })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({ id: 'blueprint-123', meta })
        expect(mockJsonpath).not.toHaveBeenCalled()
        expect(mockJmespath).not.toHaveBeenCalled()
      })

      it('should apply a JSONPath filter when provided', async () => {
        const meta = { notes: { note1: { data: 'hello' } }, version: 2 }

        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: '$.notes',
          jmespath: undefined,
        })

        mockFindUnique.mockResolvedValue({ id: 'blueprint-123', meta })
        mockJsonpath.mockReturnValue({ note1: { data: 'hello' } })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({
          id: 'blueprint-123',
          meta: { note1: { data: 'hello' } },
        })
        expect(mockJsonpath).toHaveBeenCalledWith('$.notes', meta)
        expect(mockJmespath).not.toHaveBeenCalled()
      })

      it('should apply a JMESPath filter when provided', async () => {
        const meta = { notes: { note1: { data: 'hello' } }, version: 2 }

        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: undefined,
          jmespath: 'notes.note1',
        })

        mockFindUnique.mockResolvedValue({ id: 'blueprint-123', meta })
        mockJmespath.mockReturnValue({ data: 'hello' })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({
          id: 'blueprint-123',
          meta: { data: 'hello' },
        })
        expect(mockJmespath).toHaveBeenCalledWith('notes.note1', meta)
        expect(mockJsonpath).not.toHaveBeenCalled()
      })

      it('should prefer JSONPath over JMESPath when both are provided', async () => {
        const meta = { notes: {}, version: 1 }

        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: '$.version',
          jmespath: 'notes',
        })

        mockFindUnique.mockResolvedValue({ id: 'blueprint-123', meta })
        mockJsonpath.mockReturnValue(1)
        mockLogEvent.mockResolvedValue(undefined)

        await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(mockJsonpath).toHaveBeenCalledWith('$.version', meta)
        expect(mockJmespath).not.toHaveBeenCalled()
      })

      it('should treat a null meta as an empty object', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: undefined,
          jmespath: undefined,
        })

        mockFindUnique.mockResolvedValue({ id: 'blueprint-123', meta: null })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBeUndefined()
        expect(result.result).toEqual({ id: 'blueprint-123', meta: {} })
      })
    })

    describe('edge cases', () => {
      it('should handle missing blueprint ID', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: undefined,
          jsonpath: undefined,
          jmespath: undefined,
        })

        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBe(
          'No blueprint ID found in context or parameters'
        )
        expect(result.result).toEqual([])
        expect(result.messages).toEqual([])
        expect(mockFindUnique).not.toHaveBeenCalled()
      })

      it('should handle blueprint not found', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-missing',
          jsonpath: undefined,
          jmespath: undefined,
        })

        mockFindUnique.mockResolvedValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBe('Blueprint not found or access denied')
        expect(result.result).toEqual([])
      })
    })

    describe('error handling', () => {
      it('should handle prisma errors gracefully', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          jsonpath: undefined,
          jmespath: undefined,
        })

        mockFindUnique.mockRejectedValue(new Error('DB connection failed'))
        mockLogEvent.mockResolvedValue(undefined)

        const result = await doBlueprintMetaFetch({
          input: 'fetch meta',
          params: {},
          options: { userId: 'user-123' },
        })

        expect(result.error).toBe(
          'Failed to fetch blueprint meta: DB connection failed'
        )
        expect(result.result).toEqual([])
        expect(result.messages).toEqual([])
      })
    })
  })

  describe('doBlueprintBulletinList', () => {
    const mockGetConfigBySchema =
      require('@/lib/action.config').getConfigBySchema
    const mockGetContextBot = require('@/lib/context.store').getContextBot
    const mockLogEvent = require('@/lib/log').logEvent
    const mockFindUnique = require('@/prisma/client').blueprint.findUnique
    const mockListBulletins =
      require('@/lib/blueprint.bulletin').listBlueprintBulletins

    it('should list the active bulletins for a blueprint', async () => {
      const bulletins = [
        {
          id: 'bulletin-1',
          text: 'hello',
          createdAt: 1,
          expiresAt: 2,
        },
      ]

      mockGetConfigBySchema.mockReturnValue({ blueprintId: 'blueprint-123' })
      mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
      mockListBulletins.mockResolvedValue(bulletins)
      mockGetContextBot.mockReturnValue(null)
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinList({
        input: 'list bulletins',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBeUndefined()
      // @note dates are converted to ISO 8601 plus a relative timeAgo form for
      // the agent; raw epoch-ms timestamps are not surfaced. `self` is false
      // here because there is no context bot to match against.
      expect(result.result).toEqual({
        id: 'blueprint-123',
        bulletins: [
          {
            id: 'bulletin-1',
            text: 'hello',
            createdAt: new Date(1).toISOString(),
            createdAgo: expect.any(String),
            expiresAt: new Date(2).toISOString(),
            expiresIn: expect.any(String),
            self: false,
          },
        ],
      })
      expect(mockListBulletins).toHaveBeenCalledWith('blueprint-123')
    })

    it('should tag only bulletins posted by the current bot as self', async () => {
      const bulletins = [
        {
          id: 'b-own',
          text: 'mine',
          botId: 'bot-1',
          createdAt: 1,
          expiresAt: 2,
        },
        {
          id: 'b-other',
          text: 'theirs',
          botId: 'bot-2',
          createdAt: 1,
          expiresAt: 2,
        },
        { id: 'b-anon', text: 'anon', createdAt: 1, expiresAt: 2 },
      ]

      mockGetConfigBySchema.mockReturnValue({ blueprintId: 'blueprint-123' })
      mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
      mockListBulletins.mockResolvedValue(bulletins)
      mockGetContextBot.mockReturnValue({ id: 'bot-1', name: 'Current Bot' })
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinList({
        input: 'list bulletins',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBeUndefined()
      expect(
        result.result.bulletins.map(({ id, self }) => ({ id, self }))
      ).toEqual([
        { id: 'b-own', self: true },
        { id: 'b-other', self: false },
        { id: 'b-anon', self: false },
      ])
    })

    it('should not tag an anonymous bulletin as self when there is no context bot', async () => {
      const bulletins = [
        { id: 'b-anon', text: 'anon', createdAt: 1, expiresAt: 2 },
      ]

      mockGetConfigBySchema.mockReturnValue({ blueprintId: 'blueprint-123' })
      mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
      mockListBulletins.mockResolvedValue(bulletins)
      mockGetContextBot.mockReturnValue(null)
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinList({
        input: 'list bulletins',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBeUndefined()
      expect(result.result.bulletins[0].self).toBe(false)
    })

    it('should handle missing blueprint ID', async () => {
      mockGetConfigBySchema.mockReturnValue({ blueprintId: undefined })
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinList({
        input: 'list bulletins',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBe(
        'No blueprint ID found in context or parameters'
      )
      expect(mockFindUnique).not.toHaveBeenCalled()
    })

    it('should handle blueprint not found', async () => {
      mockGetConfigBySchema.mockReturnValue({
        blueprintId: 'blueprint-missing',
      })
      mockFindUnique.mockResolvedValue(null)
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinList({
        input: 'list bulletins',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBe('Blueprint not found or access denied')
    })
  })

  describe('doBlueprintBulletinCreate', () => {
    const mockGetConfigBySchema =
      require('@/lib/action.config').getConfigBySchema
    const mockGetContextBot = require('@/lib/context.store').getContextBot
    const mockLogEvent = require('@/lib/log').logEvent
    const mockFindUnique = require('@/prisma/client').blueprint.findUnique
    const mockCreateBulletin =
      require('@/lib/blueprint.bulletin').createBlueprintBulletin

    it('should create a bulletin and attach the context bot name and id', async () => {
      const bulletin = {
        id: 'bulletin-1',
        text: 'hello',
        author: 'Test Bot',
        botId: 'bot-1',
        createdAt: 1,
        expiresAt: 2,
      }

      mockGetConfigBySchema.mockReturnValue({
        blueprintId: 'blueprint-123',
        text: 'hello',
        ttl: 120,
      })
      mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
      mockGetContextBot.mockReturnValue({ id: 'bot-1', name: 'Test Bot' })
      mockCreateBulletin.mockResolvedValue(bulletin)
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinCreate({
        input: 'post bulletin',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBeUndefined()
      // @note dates are converted to ISO 8601 plus a relative timeAgo form.
      // `self` is true because the creating bot is the current context bot.
      expect(result.result).toEqual({
        id: 'blueprint-123',
        bulletin: {
          id: 'bulletin-1',
          text: 'hello',
          author: 'Test Bot',
          botId: 'bot-1',
          createdAt: new Date(1).toISOString(),
          createdAgo: expect.any(String),
          expiresAt: new Date(2).toISOString(),
          expiresIn: expect.any(String),
          self: true,
        },
      })
      expect(mockCreateBulletin).toHaveBeenCalledWith('blueprint-123', {
        text: 'hello',
        ttl: 120,
        author: 'Test Bot',
        botId: 'bot-1',
      })
    })

    it('should handle blueprint not found', async () => {
      mockGetConfigBySchema.mockReturnValue({
        blueprintId: 'blueprint-missing',
        text: 'hello',
      })
      mockFindUnique.mockResolvedValue(null)
      mockGetContextBot.mockReturnValue(null)
      mockLogEvent.mockResolvedValue(undefined)

      const result = await doBlueprintBulletinCreate({
        input: 'post bulletin',
        params: {},
        options: { userId: 'user-123' },
      })

      expect(result.error).toBe('Blueprint not found or access denied')
      expect(mockCreateBulletin).not.toHaveBeenCalled()
    })
  })

  describe('executeBlueprintAction', () => {
    const mockGetConfigBySchema =
      require('@/lib/action.config').getConfigBySchema
    const mockGetUserClient = require('@/lib/cbk.sdk').getUserClient
    const mockGetContextBot = require('@/lib/context.store').getContextBot
    const mockLogEvent = require('@/lib/log').logEvent

    describe('operation routing', () => {
      it('should route to resource/list operation', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {},
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await executeBlueprintAction(
          'list resources',
          { resource: true, list: true },
          {
            userId: 'user-123',
            linkedResources: {},
          }
        )

        expect(result.error).toBeUndefined()
        expect(mockListResources).toHaveBeenCalled()
      })

      it('should route to bulletin/list operation', async () => {
        const mockFindUnique = require('@/prisma/client').blueprint.findUnique
        const mockListBulletins =
          require('@/lib/blueprint.bulletin').listBlueprintBulletins

        mockGetConfigBySchema.mockReturnValue({ blueprintId: 'blueprint-123' })
        mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
        mockListBulletins.mockResolvedValue([])
        mockLogEvent.mockResolvedValue(undefined)

        const result = await executeBlueprintAction(
          'list bulletins',
          { bulletin: true, list: true },
          { userId: 'user-123' }
        )

        expect(result.error).toBeUndefined()
        expect(mockListBulletins).toHaveBeenCalledWith('blueprint-123')
      })

      it('should route to bulletin/create operation', async () => {
        const mockFindUnique = require('@/prisma/client').blueprint.findUnique
        const mockCreateBulletin =
          require('@/lib/blueprint.bulletin').createBlueprintBulletin

        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          text: 'hello',
        })
        mockFindUnique.mockResolvedValue({ id: 'blueprint-123' })
        mockGetContextBot.mockReturnValue(null)
        mockCreateBulletin.mockResolvedValue({
          id: 'bulletin-1',
          text: 'hello',
          createdAt: 1,
          expiresAt: 2,
        })
        mockLogEvent.mockResolvedValue(undefined)

        const result = await executeBlueprintAction(
          'post bulletin',
          { bulletin: true, create: true },
          { userId: 'user-123' }
        )

        expect(result.error).toBeUndefined()
        expect(mockCreateBulletin).toHaveBeenCalled()
      })

      it('should default to resource/list operation', async () => {
        mockGetConfigBySchema.mockReturnValue({
          blueprintId: 'blueprint-123',
          type: 'all',
        })

        const mockListResources = jest.fn().mockResolvedValue({
          id: 'blueprint-123',
          resources: {},
        })

        mockGetUserClient.mockResolvedValue({
          blueprint: {
            listResources: mockListResources,
          },
        })

        mockGetContextBot.mockReturnValue(null)
        mockLogEvent.mockResolvedValue(undefined)

        const result = await executeBlueprintAction(
          'unknown operation',
          {},
          {
            userId: 'user-123',
            linkedResources: {},
          }
        )

        expect(result.error).toBeUndefined()
        expect(mockListResources).toHaveBeenCalled()
      })
    })
  })
})
