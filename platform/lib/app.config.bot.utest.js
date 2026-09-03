import {
  getConfiguredBots,
  isHiddenBotByConvention,
  isVisibleBotByConvention,
} from '@/lib/app.config.bot'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { isModelBot } from '@/lib/bot.kind'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'

jest.mock('@/lib/cbk.graphql', () => ({
  getSessionGraphQLClient: jest.fn(),
}))

jest.mock('@/lib/bot.kind', () => ({
  isModelBot: jest.fn(),
}))

describe('app.config.bot', () => {
  describe('isHiddenBotByConvention', () => {
    it('should return true for bots with names starting with a dot', () => {
      const bot = {
        id: 'bot1',
        name: '.hiddenBot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with names starting with a dot and whitespace', () => {
      const bot = {
        id: 'bot2',
        name: ' .hiddenBot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with names starting with multiple spaces and a dot', () => {
      const bot = {
        id: 'bot6',
        name: '   .hiddenBot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with names starting with tab and dot', () => {
      const bot = {
        id: 'bot7',
        name: '\t.hiddenBot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(true)
    })

    it('should return false for bots with names not starting with a dot', () => {
      const bot = {
        id: 'bot3',
        name: 'visibleBot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should return false for bots with names containing a dot but not at the beginning', () => {
      const bot = {
        id: 'bot4',
        name: 'visible.Bot',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should return false for bots with names ending with a dot', () => {
      const bot = {
        id: 'bot8',
        name: 'visibleBot.',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should handle undefined name by treating it as empty string', () => {
      const bot = {
        id: 'bot5',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should handle empty string name', () => {
      const bot = {
        id: 'bot9',
        name: '',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should handle name with only whitespace', () => {
      const bot = {
        id: 'bot10',
        name: '   ',
      }

      expect(isHiddenBotByConvention(bot)).toBe(false)
    })

    it('should be case insensitive when checking for dot', () => {
      const bot = {
        id: 'bot11',
        name: '.HIDDENBOT',
      }

      expect(isHiddenBotByConvention(bot)).toBe(true)
    })
  })

  describe('isVisibleBotByConvention', () => {
    it('should return false for bots with names starting with a dot', () => {
      const bot = {
        id: 'bot1',
        name: '.hiddenBot',
      }

      expect(isVisibleBotByConvention(bot)).toBe(false)
    })

    it('should return false for bots with names starting with whitespace and dot', () => {
      const bot = {
        id: 'bot2',
        name: ' .hiddenBot',
      }

      expect(isVisibleBotByConvention(bot)).toBe(false)
    })

    it('should return true for bots with names not starting with a dot', () => {
      const bot = {
        id: 'bot3',
        name: 'visibleBot',
      }

      expect(isVisibleBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with undefined name', () => {
      const bot = {
        id: 'bot4',
      }

      expect(isVisibleBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with empty name', () => {
      const bot = {
        id: 'bot5',
        name: '',
      }

      expect(isVisibleBotByConvention(bot)).toBe(true)
    })

    it('should return true for bots with names containing dot in the middle', () => {
      const bot = {
        id: 'bot6',
        name: 'visible.Bot',
      }

      expect(isVisibleBotByConvention(bot)).toBe(true)
    })
  })

  describe('getConfiguredBots', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      // Default mock implementations
      isModelBot.mockImplementation((bot) => {
        return /gpt|claude/i.test(bot.name || '')
      })
    })

    describe('with no configured bots', () => {
      it('should return all bots from the GraphQL API when no bots are configured', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                {
                  node: {
                    id: 'bot1',
                    name: 'Bot One',
                    description: 'First bot',
                  },
                },
                {
                  node: {
                    id: 'bot2',
                    name: 'Bot Two',
                    description: 'Second bot',
                  },
                },
              ],
            },
            relatedBots: {
              edges: [],
            },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(getSessionGraphQLClient).toHaveBeenCalledWith(session)
        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: null,
          includeRelatedBots: false,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: 'First bot' },
          { id: 'bot2', name: 'Bot Two', description: 'Second bot' },
        ])
      })

      it('should filter out hidden bots by convention for APP_AUDIENCE', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2', name: '.hiddenBot' } },
                { node: { id: 'bot3', name: 'Bot Three' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot3', name: 'Bot Three', description: undefined },
        ])
        expect(result).not.toContainEqual(
          expect.objectContaining({ id: 'bot2' })
        )
      })

      it('should not filter hidden bots when audience is not APP_AUDIENCE', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: 'other-audience' },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2', name: '.hiddenBot' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toHaveLength(2)
        expect(result).toContainEqual({
          id: 'bot1',
          name: 'Bot One',
          description: undefined,
        })
        expect(result).toContainEqual({
          id: 'bot2',
          name: '.hiddenBot',
          description: undefined,
        })
      })

      it('should handle empty bots response', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: { edges: [] },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([])
      })

      it('should handle undefined bots and relatedBots', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({}),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([])
      })

      it('should skip edges with null or undefined nodes', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: null },
                null,
                { node: { id: 'bot2', name: 'Bot Two' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot2', name: 'Bot Two', description: undefined },
        ])
      })

      it('should skip nodes with null or undefined id', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: null, name: 'No ID Bot' } },
                { node: { name: 'No ID Bot 2' } },
                { node: { id: 'bot2', name: 'Bot Two' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot2', name: 'Bot Two', description: undefined },
        ])
      })
    })

    describe('with configured bots as string array', () => {
      it('should fetch only configured bots when bots array contains strings', async () => {
        const config = {
          bots: ['bot1', 'bot2'],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One', description: 'First' } },
                {
                  node: { id: 'bot2', name: 'Bot Two', description: 'Second' },
                },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: ['bot1', 'bot2'],
          includeRelatedBots: true,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: 'First' },
          { id: 'bot2', name: 'Bot Two', description: 'Second' },
        ])
      })

      it('should merge related bots with configured bots', async () => {
        const config = {
          bots: ['bot1'],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: {
              edges: [{ node: { id: 'bot2', name: 'Related Bot' } }],
            },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toHaveLength(2)
        expect(result).toContainEqual({
          id: 'bot1',
          name: 'Bot One',
          description: undefined,
        })
        expect(result).toContainEqual({
          id: 'bot2',
          name: 'Related Bot',
          description: undefined,
        })
      })
    })

    describe('with configured bots as object array', () => {
      it('should handle bots array with full config objects', async () => {
        const config = {
          bots: [
            {
              id: 'bot1',
              name: 'Custom Name',
              description: 'Custom Desc',
              nick: 'custom',
              icon: 'icon.png',
              default: true,
            },
          ],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                {
                  node: {
                    id: 'bot1',
                    name: 'Bot One',
                    description: 'Original',
                  },
                },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          {
            id: 'bot1',
            name: 'Custom Name',
            description: 'Custom Desc',
            nick: 'custom',
            icon: 'icon.png',
            default: true,
          },
        ])
      })

      it('should exclude bots marked with exclude: true', async () => {
        const config = {
          bots: [{ id: 'bot1' }, { id: 'bot2', exclude: true }, { id: 'bot3' }],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2', name: 'Bot Two' } },
                { node: { id: 'bot3', name: 'Bot Three' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: ['bot1', 'bot3'],
          includeRelatedBots: true,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot3', name: 'Bot Three', description: undefined },
        ])
        expect(result).not.toContainEqual(
          expect.objectContaining({ id: 'bot2' })
        )
      })

      it('should merge custom config with bot data from GraphQL', async () => {
        const config = {
          bots: [
            {
              id: 'bot1',
              nick: 'CustomNick',
              icon: 'custom.png',
            },
          ],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                {
                  node: {
                    id: 'bot1',
                    name: 'Bot One',
                    description: 'Original Desc',
                  },
                },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          {
            id: 'bot1',
            name: 'Bot One',
            description: 'Original Desc',
            nick: 'CustomNick',
            icon: 'custom.png',
          },
        ])
      })
    })

    describe('with configured bots as object map', () => {
      it('should handle bots as a record/object map', async () => {
        const config = {
          bots: {
            bot1: { name: 'Custom One' },
            bot2: { name: 'Custom Two', description: 'Custom Desc' },
          },
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                {
                  node: {
                    id: 'bot1',
                    name: 'Bot One',
                    description: 'Desc One',
                  },
                },
                {
                  node: {
                    id: 'bot2',
                    name: 'Bot Two',
                    description: 'Desc Two',
                  },
                },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: expect.arrayContaining(['bot1', 'bot2']),
          includeRelatedBots: true,
        })
        expect(result).toHaveLength(2)
        expect(result).toContainEqual(
          expect.objectContaining({ id: 'bot1', name: 'Custom One' })
        )
        expect(result).toContainEqual(
          expect.objectContaining({
            id: 'bot2',
            name: 'Custom Two',
            description: 'Custom Desc',
          })
        )
      })

      it('should exclude bots in object map marked with exclude: true', async () => {
        const config = {
          bots: {
            bot1: {},
            bot2: { exclude: true },
            bot3: {},
          },
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2', name: 'Bot Two' } },
                { node: { id: 'bot3', name: 'Bot Three' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot3', name: 'Bot Three', description: undefined },
        ])
        expect(result).not.toContainEqual(
          expect.objectContaining({ id: 'bot2' })
        )
      })
    })

    describe('sorting behavior', () => {
      it('should sort model bots to the bottom', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'GPT-4' } },
                { node: { id: 'bot2', name: 'Assistant Bot' } },
                { node: { id: 'bot3', name: 'Claude' } },
                { node: { id: 'bot4', name: 'Regular Bot' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result[0].name).toBe('Assistant Bot')
        expect(result[1].name).toBe('Regular Bot')
        expect(result[2].name).toBe('Claude')
        expect(result[3].name).toBe('GPT-4')
      })

      it('should sort non-model bots alphabetically by name', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        isModelBot.mockReturnValue(false)

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Zebra Bot' } },
                { node: { id: 'bot2', name: 'Alpha Bot' } },
                { node: { id: 'bot3', name: 'Beta Bot' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result[0].name).toBe('Alpha Bot')
        expect(result[1].name).toBe('Beta Bot')
        expect(result[2].name).toBe('Zebra Bot')
      })

      it('should sort model bots alphabetically among themselves', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        isModelBot.mockReturnValue(true)

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'GPT-4' } },
                { node: { id: 'bot2', name: 'Claude-2' } },
                { node: { id: 'bot3', name: 'GPT-3' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result[0].name).toBe('Claude-2')
        expect(result[1].name).toBe('GPT-3')
        expect(result[2].name).toBe('GPT-4')
      })

      it('should handle bots with undefined names in sorting', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        isModelBot.mockReturnValue(false)

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2' } },
                { node: { id: 'bot3', name: 'Bot Three' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toHaveLength(3)
        expect(result.map((b) => b.id)).toContain('bot2')
      })
    })

    describe('edge cases and error handling', () => {
      it('should handle invalid bots config gracefully', async () => {
        const config = {
          bots: 'invalid-config',
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: null,
          includeRelatedBots: false,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
        ])
      })

      it('should not process bots config when audience is not APP_AUDIENCE', async () => {
        const config = {
          bots: ['bot1', 'bot2'],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: 'other-audience' },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                { node: { id: 'bot1', name: 'Bot One' } },
                { node: { id: 'bot2', name: 'Bot Two' } },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: null,
          includeRelatedBots: false,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
          { id: 'bot2', name: 'Bot Two', description: undefined },
        ])
      })

      it('should handle empty config object', async () => {
        const config = {}
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
        ])
      })

      it('should handle null bots in config', async () => {
        const config = {
          bots: null,
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: null,
          includeRelatedBots: false,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
        ])
      })

      it('should handle empty arrays in bots config', async () => {
        const config = {
          bots: [],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        // Empty array is valid config and sets hasConfiguredBots to true
        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: [],
          includeRelatedBots: true,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
        ])
      })

      it('should handle empty object in bots config', async () => {
        const config = {
          bots: {},
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [{ node: { id: 'bot1', name: 'Bot One' } }],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        // Empty object passes Zod validation as z.record and sets hasConfiguredBots to true
        expect(mockClient.configuredBots).toHaveBeenCalledWith({
          blueprintIds: null,
          botIds: [],
          includeRelatedBots: true,
        })
        expect(result).toEqual([
          { id: 'bot1', name: 'Bot One', description: undefined },
        ])
      })

      it('should preserve all custom config properties when merging', async () => {
        const config = {
          bots: [
            {
              id: 'bot1',
              name: 'Custom Name',
              description: 'Custom Desc',
              nick: 'nick',
              icon: 'icon.png',
              default: true,
              auto: true,
              multi: true,
            },
          ],
        }
        const session = {
          user: { id: 'user1' },
          payload: { aud: APP_AUDIENCE },
        }

        const mockClient = {
          configuredBots: jest.fn().mockResolvedValue({
            bots: {
              edges: [
                {
                  node: {
                    id: 'bot1',
                    name: 'Original Name',
                    description: 'Original Desc',
                  },
                },
              ],
            },
            relatedBots: { edges: [] },
          }),
        }

        getSessionGraphQLClient.mockResolvedValue(mockClient)

        const result = await getConfiguredBots(config, session)

        expect(result).toEqual([
          {
            id: 'bot1',
            name: 'Custom Name',
            description: 'Custom Desc',
            nick: 'nick',
            icon: 'icon.png',
            default: true,
            auto: true,
            multi: true,
          },
        ])
      })
    })
  })
})
