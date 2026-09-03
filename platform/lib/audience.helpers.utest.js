import {
  API_AUDIENCE,
  APP_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'
import {
  isExtendedTrustedAudience,
  isTrustedAudience,
  isTrustedSession,
} from '@/lib/audience.helpers'

describe('audience utilities', () => {
  describe('isTrustedAudience', () => {
    describe('trusted audiences', () => {
      it('should return true for USER_AUDIENCE', () => {
        expect(isTrustedAudience(USER_AUDIENCE)).toBe(true)
      })

      it('should return true for API_AUDIENCE', () => {
        expect(isTrustedAudience(API_AUDIENCE)).toBe(true)
      })
    })

    describe('untrusted audiences', () => {
      it('should return false for APP_AUDIENCE', () => {
        expect(isTrustedAudience(APP_AUDIENCE)).toBe(false)
      })

      it('should return false for random string', () => {
        expect(isTrustedAudience('random-audience')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isTrustedAudience('')).toBe(false)
      })

      it('should return false for null', () => {
        expect(isTrustedAudience(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isTrustedAudience(undefined)).toBe(false)
      })
    })
  })

  describe('isExtendedTrustedAudience', () => {
    describe('extended trusted audiences', () => {
      it('should return true for USER_AUDIENCE', () => {
        expect(isExtendedTrustedAudience(USER_AUDIENCE)).toBe(true)
      })

      it('should return true for API_AUDIENCE', () => {
        expect(isExtendedTrustedAudience(API_AUDIENCE)).toBe(true)
      })

      it('should return true for APP_AUDIENCE', () => {
        expect(isExtendedTrustedAudience(APP_AUDIENCE)).toBe(true)
      })
    })

    describe('untrusted audiences', () => {
      it('should return false for random string', () => {
        expect(isExtendedTrustedAudience('random-audience')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isExtendedTrustedAudience('')).toBe(false)
      })

      it('should return false for null', () => {
        expect(isExtendedTrustedAudience(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isExtendedTrustedAudience(undefined)).toBe(false)
      })
    })

    describe('difference from isTrustedAudience', () => {
      it('should include APP_AUDIENCE while isTrustedAudience does not', () => {
        expect(isExtendedTrustedAudience(APP_AUDIENCE)).toBe(true)
        expect(isTrustedAudience(APP_AUDIENCE)).toBe(false)
      })
    })
  })

  describe('isTrustedSession', () => {
    describe('trusted sessions', () => {
      it('should return true for session with USER_AUDIENCE', () => {
        const session = {
          payload: {
            aud: USER_AUDIENCE,
          },
        }

        expect(isTrustedSession(session)).toBe(true)
      })

      it('should return true for session with API_AUDIENCE', () => {
        const session = {
          payload: {
            aud: API_AUDIENCE,
          },
        }

        expect(isTrustedSession(session)).toBe(true)
      })
    })

    describe('untrusted sessions', () => {
      it('should return false for session with APP_AUDIENCE', () => {
        const session = {
          payload: {
            aud: APP_AUDIENCE,
          },
        }

        expect(isTrustedSession(session)).toBe(false)
      })

      it('should return false for session with random audience', () => {
        const session = {
          payload: {
            aud: 'random-audience',
          },
        }

        expect(isTrustedSession(session)).toBe(false)
      })

      it('should return false for session with null audience', () => {
        const session = {
          payload: {
            aud: null,
          },
        }

        expect(isTrustedSession(session)).toBe(false)
      })

      it('should return false for session with undefined audience', () => {
        const session = {
          payload: {
            aud: undefined,
          },
        }

        expect(isTrustedSession(session)).toBe(false)
      })
    })

    describe('session object structure', () => {
      it('should work with complete session object with additional properties', () => {
        const session = {
          payload: {
            aud: USER_AUDIENCE,
            sub: 'user-123',
            exp: Date.now() + 3600000,
            iat: Date.now(),
          },
          additionalData: 'some-data',
        }

        expect(isTrustedSession(session)).toBe(true)
      })
    })
  })
})
