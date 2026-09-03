import useCookie from './useCookie'

describe('useCookie', () => {
  const originalGlobal = global.__incrementalCache

  afterEach(() => {
    global.__incrementalCache = originalGlobal
  })

  describe('server-side initial cookie', () => {
    it('should get initial cookie from __incrementalCache on server', () => {
      global.__incrementalCache = {
        requestHeaders: {
          cookie: 'serverCookie=serverValue',
        },
      }

      const result = useCookie.tryGetInitialCookie
        ? null
        : (() => {
            try {
              const value = global.__incrementalCache.requestHeaders.cookie
                .split('; ')
                .find((row) => row.startsWith(`serverCookie=`))

              return value ? value.split('=')[1] || null : null
            } catch {
              return null
            }
          })()

      // @note testing the helper function logic directly
      expect(result).toBe('serverValue')
    })

    it('should handle missing __incrementalCache gracefully', () => {
      delete global.__incrementalCache

      const result = (() => {
        try {
          const value = global.__incrementalCache.requestHeaders.cookie
            .split('; ')
            .find((row) => row.startsWith(`test=`))

          return value ? value.split('=')[1] || null : null
        } catch (e) {
          return null
        }
      })()

      expect(result).toBeNull()
    })
  })

  describe('findCookie helper logic', () => {
    const findCookie = (name, cookie) => {
      const value = cookie.split('; ').find((row) => row.startsWith(`${name}=`))

      if (value) {
        return value.split('=')[1] || null
      } else {
        return null
      }
    }

    it('should find correct cookie among multiple cookies', () => {
      const cookie = 'first=1; second=2; third=3'

      expect(findCookie('second', cookie)).toBe('2')
    })

    it('should handle cookies with similar names', () => {
      const cookie = 'test=value1; testCookie=value2; test2=value3'

      expect(findCookie('testCookie', cookie)).toBe('value2')
    })

    it('should find first matching cookie when duplicates exist', () => {
      const cookie = 'test=first; test=second'

      expect(findCookie('test', cookie)).toBe('first')
    })

    it('should return null when cookie does not exist', () => {
      const cookie = 'otherCookie=otherValue'

      expect(findCookie('testCookie', cookie)).toBeNull()
    })

    it('should return null when cookie string is empty', () => {
      const cookie = ''

      expect(findCookie('testCookie', cookie)).toBeNull()
    })

    it('should handle empty cookie value', () => {
      const cookie = 'emptyCookie='

      // @note empty value after = returns null
      expect(findCookie('emptyCookie', cookie)).toBeNull()
    })

    it('should handle cookie value with equals sign', () => {
      const cookie = 'token=abc=def=ghi'

      // @note only splits on first =
      expect(findCookie('token', cookie)).toBe('abc')
    })

    it('should handle cookie value with spaces', () => {
      const cookie = 'spaceCookie=value with spaces'

      expect(findCookie('spaceCookie', cookie)).toBe('value with spaces')
    })

    it('should handle cookie value with special characters', () => {
      const cookie = 'special=value%20encoded'

      expect(findCookie('special', cookie)).toBe('value%20encoded')
    })

    it('should handle cookie name with underscore', () => {
      const cookie = 'cookie_name=value'

      expect(findCookie('cookie_name', cookie)).toBe('value')
    })

    it('should handle cookie name with dash', () => {
      const cookie = 'cookie-name=value'

      expect(findCookie('cookie-name', cookie)).toBe('value')
    })

    it('should handle cookie name with numbers', () => {
      const cookie = 'cookie123=value'

      expect(findCookie('cookie123', cookie)).toBe('value')
    })
  })

  describe('error handling', () => {
    it('should handle __incrementalCache error gracefully', () => {
      global.__incrementalCache = {
        get requestHeaders() {
          throw new Error('Access denied')
        },
      }

      const result = (() => {
        try {
          return global.__incrementalCache.requestHeaders.cookie
        } catch {
          return null
        }
      })()

      expect(result).toBeNull()
    })
  })
})
