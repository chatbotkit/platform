import {
  createTwilioConversationRelayXml,
  createTwilioDialXml,
  createTwilioSmsResponseXml,
} from '@/lib/twilio.twiml'

describe('twilio.twiml', () => {
  describe('createTwilioSmsResponseXml', () => {
    it('creates SMS XML with text and image messages and skips unsupported types', () => {
      const xml = createTwilioSmsResponseXml([
        { type: 'text', text: 'hello world' },
        { type: 'image', image: 'https://example.com/image.jpg' },
        { type: 'other', value: 'ignored' },
      ])

      expect(xml).toContain('<Response>')
      expect(xml).toContain('<Message>hello world</Message>')
      expect(xml).toContain(
        '<Message><Media>https://example.com/image.jpg</Media></Message>'
      )
      expect(xml).not.toContain('ignored')
    })

    it('creates empty response XML for empty messages', () => {
      const xml = createTwilioSmsResponseXml([])

      expect(xml).toBe('')
    })
  })

  describe('createTwilioConversationRelayXml', () => {
    it('creates relay XML with url and provided options', () => {
      const xml = createTwilioConversationRelayXml('wss://example.com/relay', {
        ttsLanguage: 'en-US',
        ttsProvider: 'Google',
        voice: 'en-US-Wavenet-D',
        reportInputDuringAgentSpeech: 'none',
        speechTimeout: 'auto',
      })

      expect(xml).toContain('<Response>')
      expect(xml).toContain('<Connect>')
      expect(xml).toContain('<ConversationRelay')
      expect(xml).toContain('url="wss://example.com/relay"')
      expect(xml).toContain('ttsLanguage="en-US"')
      expect(xml).toContain('ttsProvider="Google"')
      expect(xml).toContain('voice="en-US-Wavenet-D"')
      expect(xml).toContain('reportInputDuringAgentSpeech="none"')
      expect(xml).toContain('speechTimeout="auto"')
    })

    it('filters out null, undefined, and empty string options', () => {
      const xml = createTwilioConversationRelayXml('wss://example.com/relay', {
        ttsLanguage: '',
        ttsProvider: undefined,
        voice: null,
        reportInputDuringAgentSpeech: 'all',
      })

      expect(xml).toContain('url="wss://example.com/relay"')
      expect(xml).toContain('reportInputDuringAgentSpeech="all"')
      expect(xml).not.toContain('ttsLanguage=')
      expect(xml).not.toContain('ttsProvider=')
      expect(xml).not.toContain('voice=')
    })
  })

  describe('createTwilioDialXml', () => {
    it('creates Dial XML for a routed call', () => {
      const xml = createTwilioDialXml('+14155552671')

      expect(xml).toContain('<Response>')
      expect(xml).toContain('<Dial>+14155552671</Dial>')
    })
  })
})
