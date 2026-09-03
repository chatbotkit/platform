import { assertAllowedBotId, getAllowedBotIds } from './bot.policy'

describe('task bot policy', () => {
  describe('getAllowedBotIds', () => {
    it('should return null when bots config is missing', () => {
      expect(getAllowedBotIds({})).toBeNull()
    })

    it('should normalize string and object bot configs to ids', () => {
      expect(
        getAllowedBotIds({
          bots: ['bot-a', { id: 'bot-b', name: 'Bot B' }],
        })
      ).toEqual(['bot-a', 'bot-b'])
    })
  })

  describe('assertAllowedBotId', () => {
    it('should allow missing botId', () => {
      expect(() => assertAllowedBotId(['bot-a'], undefined)).not.toThrow()
    })

    it('should allow any bot when allowlist is not configured', () => {
      expect(() => assertAllowedBotId(null, 'bot-any')).not.toThrow()
    })

    it('should allow botId present in allowlist', () => {
      expect(() =>
        assertAllowedBotId(['bot-a', 'bot-b'], 'bot-b')
      ).not.toThrow()
    })

    it('should reject botId not present in allowlist', () => {
      expect(() => assertAllowedBotId(['bot-a'], 'bot-z')).toThrow(
        'Bot bot-z is not allowed for this app'
      )
    })
  })
})
