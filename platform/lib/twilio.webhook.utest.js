import { getTwilioIntegrationWebhook } from '@/lib/twilio.webhook'

describe('twilio.webhook', () => {
  describe('getTwilioIntegrationWebhook', () => {
    describe('basic functionality', () => {
      it('should generate webhook URL with standard host', () => {
        const twilioIntegrationId = 'twilio-123'
        const host = 'chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toBe(
          'https://chatbotkit.com/api/v1/integration/twilio/twilio-123/webhook#tt=15000&rp=5xx'
        )
      })

      it('should omit /api prefix for api. subdomain', () => {
        const twilioIntegrationId = 'twilio-456'
        const host = 'api.chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toBe(
          'https://api.chatbotkit.com/v1/integration/twilio/twilio-456/webhook#tt=15000&rp=5xx'
        )
      })

      it('should include /api prefix for non-api subdomains', () => {
        const twilioIntegrationId = 'twilio-789'
        const host = 'hooks.chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toBe(
          'https://hooks.chatbotkit.com/api/v1/integration/twilio/twilio-789/webhook#tt=15000&rp=5xx'
        )
      })
    })

    describe('hash parameters', () => {
      it('should include timeout parameter (tt) set to 15000', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'test.com')

        expect(result).toContain('tt=15000')
      })

      it('should include retry policy parameter (rp) set to 5xx', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'test.com')

        expect(result).toContain('rp=5xx')
      })

      it('should use hash fragment (#) for parameters', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'test.com')

        expect(result).toMatch(/#tt=15000&rp=5xx$/)
      })

      it('should properly encode hash parameters', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'test.com')
        const url = new URL(result)

        expect(url.hash).toBe('#tt=15000&rp=5xx')
      })
    })

    describe('integration ID handling', () => {
      it('should handle integration ID with special characters', () => {
        const twilioIntegrationId = 'twilio-abc_123-XYZ'
        const host = 'chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toContain(
          '/api/v1/integration/twilio/twilio-abc_123-XYZ/webhook'
        )
      })

      it('should properly encode integration ID in URL', () => {
        const twilioIntegrationId = 'twilio id with spaces'
        const host = 'chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toContain('twilio%20id%20with%20spaces')
      })

      it('should handle very long integration IDs', () => {
        const twilioIntegrationId = 'twilio-' + 'x'.repeat(100)
        const host = 'chatbotkit.com'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId, host)

        expect(result).toContain(twilioIntegrationId)
        expect(result).toMatch(/^https:/)
      })
    })

    describe('host variations', () => {
      it('should handle host without subdomain', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'example.com')

        expect(result).toBe(
          'https://example.com/api/v1/integration/twilio/test-id/webhook#tt=15000&rp=5xx'
        )
      })

      it('should handle api.subdomain.domain format', () => {
        const result = getTwilioIntegrationWebhook(
          'test-id',
          'api.test.chatbotkit.com'
        )

        expect(result).toBe(
          'https://api.test.chatbotkit.com/v1/integration/twilio/test-id/webhook#tt=15000&rp=5xx'
        )
      })

      it('should handle multiple subdomains', () => {
        const result = getTwilioIntegrationWebhook(
          'test-id',
          'app.staging.chatbotkit.com'
        )

        expect(result).toBe(
          'https://app.staging.chatbotkit.com/api/v1/integration/twilio/test-id/webhook#tt=15000&rp=5xx'
        )
      })

      it('should handle localhost', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'localhost:3000')

        expect(result).toBe(
          'https://localhost:3000/api/v1/integration/twilio/test-id/webhook#tt=15000&rp=5xx'
        )
      })
    })

    describe('edge cases', () => {
      it('should handle undefined host by using default URL behavior', () => {
        const twilioIntegrationId = 'test-id'

        const result = getTwilioIntegrationWebhook(twilioIntegrationId)

        // URL constructor uses 'undefined' as string when undefined is passed
        expect(result).toContain('https://undefined/')
        expect(result).toContain('/api/v1/integration/twilio/test-id/webhook')
      })

      it('should handle empty string as integration ID', () => {
        const result = getTwilioIntegrationWebhook('', 'chatbotkit.com')

        expect(result).toBe(
          'https://chatbotkit.com/api/v1/integration/twilio//webhook#tt=15000&rp=5xx'
        )
      })

      it('should detect api. at the start of host correctly', () => {
        // Should omit /api prefix
        expect(getTwilioIntegrationWebhook('id', 'api.example.com')).toContain(
          'https://api.example.com/v1/integration'
        )

        // Should include /api prefix (api is not at start)
        expect(
          getTwilioIntegrationWebhook('id', 'myapi.example.com')
        ).toContain('https://myapi.example.com/api/v1/integration')
      })
    })

    describe('URL structure validation', () => {
      it('should return valid URL that can be parsed', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'chatbotkit.com')

        expect(() => new URL(result)).not.toThrow()
      })

      it('should always use https protocol', () => {
        const hosts = ['chatbotkit.com', 'api.test.com', 'localhost']

        hosts.forEach((host) => {
          const result = getTwilioIntegrationWebhook('test-id', host)

          expect(result).toMatch(/^https:\/\//)
        })
      })

      it('should have consistent path structure', () => {
        const result = getTwilioIntegrationWebhook('test-id', 'chatbotkit.com')
        const url = new URL(result)

        expect(url.pathname).toMatch(
          /^\/api\/v1\/integration\/twilio\/[^/]+\/webhook$/
        )
      })
    })
  })
})
