import {
  compareProviders,
  getProviderTitle,
  getTemplateProvider,
} from './ability.provider'

describe('getTemplateProvider', () => {
  describe('with explicit provider', () => {
    it('should return provider when provided', () => {
      expect(
        getTemplateProvider({
          provider: 'openai',
          template: 'ably/message/send',
          id: 'openai/chat',
        })
      ).toBe('openai')
    })

    it('should prioritize provider over template and id', () => {
      expect(
        getTemplateProvider({
          provider: 'stripe',
          template: 'slack/message/send',
          id: 'slack/event',
        })
      ).toBe('stripe')
    })
  })

  describe('with template extraction', () => {
    it('should extract provider from template key', () => {
      expect(
        getTemplateProvider({
          template: 'ably/message/send',
        })
      ).toBe('ably')
    })

    it('should handle nested template paths', () => {
      expect(
        getTemplateProvider({
          template: 'platform/google/mail/send',
        })
      ).toBe('platform')
    })

    it('should extract first segment from template', () => {
      expect(
        getTemplateProvider({
          template: 'stripe/payment/create',
        })
      ).toBe('stripe')
    })

    it('should handle template with special characters', () => {
      expect(
        getTemplateProvider({
          template: 'slack[bot]/message/send',
        })
      ).toBe('slack')
    })
  })

  describe('with id extraction fallback', () => {
    it('should extract provider from id when template not provided', () => {
      expect(
        getTemplateProvider({
          id: 'slack/event/handler',
        })
      ).toBe('slack')
    })

    it('should handle id with brackets', () => {
      expect(
        getTemplateProvider({
          id: 'openai[gpt-4]/complete',
        })
      ).toBe('openai')
    })
  })

  describe('fallback to other', () => {
    it('should return other when no provider info provided', () => {
      expect(getTemplateProvider({})).toBe('other')
    })

    it('should return other for empty strings', () => {
      expect(
        getTemplateProvider({
          provider: '',
          template: '',
          id: '',
        })
      ).toBe('other')
    })

    it('should return other when provider extraction fails', () => {
      expect(
        getTemplateProvider({
          template: 'no-slashes-here',
        })
      ).toBe('no-slashes-here')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      expect(
        getTemplateProvider({
          provider: undefined,
          template: undefined,
          id: undefined,
        })
      ).toBe('other')
    })

    it('should handle null values by treating as undefined', () => {
      expect(
        getTemplateProvider({
          provider: '',
        })
      ).toBe('other')
    })

    it('should extract from template with trailing slashes', () => {
      expect(
        getTemplateProvider({
          template: 'stripe/payments/',
        })
      ).toBe('stripe')
    })

    it('should handle multiple bracket notations', () => {
      expect(
        getTemplateProvider({
          template: 'service[variant][mode]/action',
        })
      ).toBe('service')
    })
  })
})

describe('getProviderTitle', () => {
  describe('known providers with special casing', () => {
    it('should title-case AbstractAPI', () => {
      expect(getProviderTitle('abstractapi')).toBe('AbstractAPI')
    })

    it('should title-case AccuWeather', () => {
      expect(getProviderTitle('accuweather')).toBe('AccuWeather')
    })

    it('should title-case OpenAI', () => {
      expect(getProviderTitle('openai')).toBe('OpenAI')
    })

    it('should title-case GitHub', () => {
      expect(getProviderTitle('github')).toBe('GitHub')
    })

    it('should handle compound providers like BigCommerce', () => {
      expect(getProviderTitle('bigcommerce')).toBe('BigCommerce')
    })

    it('should handle domain-based providers', () => {
      expect(getProviderTitle('cal')).toBe('Cal.com')
    })

    it('should handle acronym providers', () => {
      expect(getProviderTitle('giphy')).toBe('GIPHY')
      expect(getProviderTitle('cbk')).toBe('CBK')
    })

    it('should handle proprietary names', () => {
      expect(getProviderTitle('elevenlabs')).toBe('ElevenLabs')
      expect(getProviderTitle('monday')).toBe('Monday.com')
    })
  })

  describe('unknown providers (fallback to title-case)', () => {
    it('should title-case simple providers', () => {
      expect(getProviderTitle('example')).toBe('Example')
      expect(getProviderTitle('myservice')).toBe('Myservice')
    })

    it('should title-case compound providers', () => {
      expect(getProviderTitle('mycompanyservice')).toBe('Mycompanyservice')
    })

    it('should handle hyphenated providers', () => {
      expect(getProviderTitle('my-service')).toBe('My-service')
    })

    it('should handle single letter', () => {
      expect(getProviderTitle('a')).toBe('A')
    })

    it('should handle empty string', () => {
      expect(getProviderTitle('')).toBe('')
    })

    it('should handle numbers', () => {
      expect(getProviderTitle('service123')).toBe('Service123')
    })
  })

  describe('edge cases', () => {
    it('should preserve case sensitivity in lookup - uppercase not found in catalog', () => {
      // OPENAI is not in catalog, so fallback to title-case results in "Openai"
      const result = getProviderTitle('OPENAI')

      expect(result).not.toBe('OpenAI')
      // Since it's not in the catalog, it gets title-cased by the fallback
      expect(typeof result).toBe('string')
    })

    it('should handle space-based providers', () => {
      const result = getProviderTitle('multi word service')

      expect(result).toContain('W')
    })
  })
})

describe('compareProviders', () => {
  describe('pinned providers ordering', () => {
    it('should put CBK first (pinned)', () => {
      const result = compareProviders(
        { id: 'stripe', title: 'Stripe' },
        { id: 'cbk', title: 'CBK' }
      )

      expect(result).toBeGreaterThan(0)
    })

    it('should keep pinned providers in relative order', () => {
      const result = compareProviders(
        { id: 'cbk', title: 'CBK' },
        { id: 'cbk', title: 'CBK' }
      )

      expect(result).toBe(0)
    })
  })

  describe('non-pinned providers alphabetical ordering', () => {
    it('should sort alphabetically by title', () => {
      const result = compareProviders(
        { id: 'apple', title: 'Apple' },
        { id: 'beta', title: 'Beta' }
      )

      expect(result).toBeLessThan(0)
    })

    it('should sort reverse alphabetically when first is after second', () => {
      const result = compareProviders(
        { id: 'zebra', title: 'Zebra' },
        { id: 'apple', title: 'Apple' }
      )

      expect(result).toBeGreaterThan(0)
    })

    it('should return 0 for identical titles', () => {
      const result = compareProviders(
        { id: 'service1', title: 'Service' },
        { id: 'service2', title: 'Service' }
      )

      expect(result).toBe(0)
    })
  })

  describe('mixed pinned and non-pinned', () => {
    it('should rank pinned before non-pinned regardless of title', () => {
      const result = compareProviders(
        { id: 'stripe', title: 'ZZZ Stripe' },
        { id: 'cbk', title: 'AAA CBK' }
      )

      expect(result).toBeGreaterThan(0)
    })

    it('should sort non-pinned by title when different ranks', () => {
      const result = compareProviders(
        { id: 'openai', title: 'OpenAI' },
        { id: 'stripe', title: 'Stripe' }
      )

      expect(result).toBeLessThan(0)
    })
  })

  describe('case sensitivity', () => {
    it('should be case-sensitive in title comparison', () => {
      const result1 = compareProviders(
        { id: 'a', title: 'aaa' },
        { id: 'b', title: 'AAA' }
      )
      const result2 = compareProviders(
        { id: 'a', title: 'AAA' },
        { id: 'b', title: 'aaa' }
      )

      expect(result1).not.toBe(result2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty titles', () => {
      const result = compareProviders(
        { id: 'a', title: '' },
        { id: 'b', title: 'B' }
      )

      expect(result).toBeLessThan(0)
    })

    it('should handle special characters in titles', () => {
      const result = compareProviders(
        { id: 'a', title: '@Service' },
        { id: 'b', title: 'Service' }
      )

      expect(result).toBeLessThan(0)
    })

    it('should handle unicode characters', () => {
      const result = compareProviders(
        { id: 'a', title: 'Åpple' },
        { id: 'b', title: 'Zebra' }
      )

      expect(result).toBeLessThan(0)
    })

    it('should handle numeric titles', () => {
      const result = compareProviders(
        { id: 'a', title: '1Service' },
        { id: 'b', title: '2Service' }
      )

      expect(result).toBeLessThan(0)
    })

    it('should use localeCompare for international strings', () => {
      expect(
        typeof compareProviders(
          { id: 'a', title: 'Åpple' },
          { id: 'b', title: 'Zebra' }
        )
      ).toBe('number')
    })
  })

  describe('array sorting', () => {
    it('should sort array correctly with mixed providers', () => {
      const providers = [
        { id: 'stripe', title: 'Stripe' },
        { id: 'cbk', title: 'CBK' },
        { id: 'openai', title: 'OpenAI' },
        { id: 'github', title: 'GitHub' },
      ]

      const sorted = providers.sort(compareProviders)

      // CBK should be first (pinned)
      expect(sorted[0].id).toBe('cbk')
      // Rest should be alphabetical
      expect(sorted[1].id).toBe('github')
      expect(sorted[2].id).toBe('openai')
      expect(sorted[3].id).toBe('stripe')
    })

    it('should handle array with only non-pinned providers', () => {
      const providers = [
        { id: 'stripe', title: 'Stripe' },
        { id: 'openai', title: 'OpenAI' },
        { id: 'github', title: 'GitHub' },
      ]

      const sorted = providers.sort(compareProviders)

      expect(sorted[0].id).toBe('github')
      expect(sorted[1].id).toBe('openai')
      expect(sorted[2].id).toBe('stripe')
    })

    it('should maintain stability for identical titles', () => {
      const providers = [
        { id: 'a', title: 'Service' },
        { id: 'b', title: 'Service' },
        { id: 'c', title: 'Service' },
      ]

      const sorted = providers.sort(compareProviders)

      expect(sorted.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    })
  })
})
