import { parseTwilioVoiceOptions } from '@/lib/twilio.voice'

describe('parseTwilioVoiceOptions', () => {
  it('returns an empty object for nullish or empty input', () => {
    expect(parseTwilioVoiceOptions(undefined)).toEqual({})
    expect(parseTwilioVoiceOptions(null)).toEqual({})
    expect(parseTwilioVoiceOptions('')).toEqual({})
  })

  it('parses provider-only voice value', () => {
    expect(parseTwilioVoiceOptions('elevenlabs')).toEqual({
      provider: 'elevenlabs',
      language: undefined,
      voice: undefined,
    })
  })

  it('parses provider with language and voice values', () => {
    expect(
      parseTwilioVoiceOptions('google/language=en-US/voice=en-US-Wavenet-D')
    ).toEqual({
      provider: 'google',
      language: 'en-US',
      voice: 'en-US-Wavenet-D',
    })
  })

  it('casts non-string values from struct config into strings', () => {
    expect(parseTwilioVoiceOptions('provider/language=true/voice=123')).toEqual(
      {
        provider: 'provider',
        language: 'true',
        voice: '123',
      }
    )
  })

  it('ignores unknown config keys', () => {
    expect(parseTwilioVoiceOptions('provider/foo=bar')).toEqual({
      provider: 'provider',
      language: undefined,
      voice: undefined,
    })
  })
})
