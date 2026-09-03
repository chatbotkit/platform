import {
  executeInContext,
  getContextAPIHost,
  getContextBot,
  getContextContact,
  getContextConversation,
  getContextFrontendHost,
  getContextNamespace,
  getContextNextApiRequest,
  getContextNextApiResponse,
  getContextRequest,
  getContextRequestHost,
  getContextRequestIpAddress,
  getContextRequestProtocol,
  getContextRequestQuery,
  getContextRequestStartTime,
  getContextRequestUserAgent,
  getContextStaticHost,
  getContextTimezone,
  getContextUser,
  getContextWidgetHost,
  getSafeStore,
  getStore,
  resetContextContact,
  resetContextNamespace,
  runInContext,
  setContextAPIHost,
  setContextBot,
  setContextContact,
  setContextConversation,
  setContextFrontendHost,
  setContextNamespace,
  setContextNextApiRequest,
  setContextNextApiResponse,
  setContextRequest,
  setContextRequestHost,
  setContextRequestIpAddress,
  setContextRequestProtocol,
  setContextRequestQuery,
  setContextRequestStartTime,
  setContextRequestUserAgent,
  setContextStaticHost,
  setContextTimezone,
  setContextUser,
  setContextWidgetHost,
} from './context.store'

describe('context', () => {
  describe('store access', () => {
    describe('getStore', () => {
      it('should throw error when no store exists', () => {
        expect(() => getStore()).toThrow('Store not found')
      })

      it('should return store when inside context', async () => {
        await executeInContext(async () => {
          const store = getStore()

          expect(store).toBeDefined()
          expect(typeof store).toBe('object')
        })
      })
    })

    describe('getSafeStore', () => {
      it('should return empty object when no store exists', () => {
        const store = getSafeStore()

        expect(store).toEqual({})
      })

      it('should return store when inside context', async () => {
        await executeInContext(async () => {
          const store = getSafeStore()

          expect(store).toBeDefined()
          expect(typeof store).toBe('object')
        })
      })
    })
  })

  describe('context execution', () => {
    describe('runInContext', () => {
      it('should wrap function to run in context', async () => {
        const fn = jest.fn(async () => {
          const store = getStore()

          return store
        })

        const wrapped = runInContext(fn)
        const result = await wrapped()

        expect(fn).toHaveBeenCalled()
        expect(result).toBeDefined()
      })

      it('should pass arguments to wrapped function', async () => {
        const fn = jest.fn(async (a, b) => a + b)

        const wrapped = runInContext(fn)
        const result = await wrapped(5, 3)

        expect(fn).toHaveBeenCalledWith(5, 3)
        expect(result).toBe(8)
      })

      it('should isolate context between calls', async () => {
        const wrapped = runInContext(async () => {
          setContextNamespace('test-1')

          return getContextNamespace()
        })

        const result1 = await wrapped()
        const result2 = await wrapped()

        expect(result1).toBe('test-1')
        expect(result2).toBe('test-1')

        // Values should not leak outside context
        const outsideValue = getContextNamespace()

        expect(outsideValue).toBeNull()
      })

      it('should not inherit parent conversation context when disableContextInheritance is true', async () => {
        await executeInContext(async () => {
          setContextConversation({ id: 'parent-conversation' })

          const wrapped = runInContext(
            async () => {
              return getContextConversation()
            },
            { disableContextInheritance: true }
          )

          await expect(wrapped()).resolves.toBeNull()
        })
      })

      it('should inherit parent conversation context by default', async () => {
        await executeInContext(async () => {
          setContextConversation({ id: 'parent-conversation' })

          const wrapped = runInContext(async () => {
            return getContextConversation()
          })

          await expect(wrapped()).resolves.toEqual({
            id: 'parent-conversation',
          })
        })
      })
    })

    describe('executeInContext', () => {
      it('should execute function immediately in context', async () => {
        let storeExists = false

        await executeInContext(async () => {
          storeExists = !!getStore()
        })

        expect(storeExists).toBe(true)
      })

      it('should return function result', async () => {
        const result = await executeInContext(async () => {
          return 'test-result'
        })

        expect(result).toBe('test-result')
      })
    })
  })

  describe('request timing', () => {
    describe('getContextRequestStartTime / setContextRequestStartTime', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const startTime = getContextRequestStartTime()

          expect(startTime).toBeUndefined()
        })
      })

      it('should store and retrieve start time', async () => {
        await executeInContext(async () => {
          const time = Date.now()

          setContextRequestStartTime(time)

          const retrieved = getContextRequestStartTime()

          expect(retrieved).toBe(time)
        })
      })

      it('should handle null store gracefully', () => {
        setContextRequestStartTime(123)
        // Should not throw
      })
    })
  })

  describe('namespace management', () => {
    describe('getContextNamespace / setContextNamespace', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const namespace = getContextNamespace()

          expect(namespace).toBeNull()
        })
      })

      it('should store and retrieve namespace', async () => {
        await executeInContext(async () => {
          setContextNamespace('test-namespace')

          const retrieved = getContextNamespace()

          expect(retrieved).toBe('test-namespace')
        })
      })

      it('should handle null store gracefully', () => {
        setContextNamespace('test')
        // Should not throw
      })
    })

    describe('resetContextNamespace', () => {
      it('should reset namespace to null', async () => {
        await executeInContext(async () => {
          setContextNamespace('test')
          expect(getContextNamespace()).toBe('test')

          resetContextNamespace()
          expect(getContextNamespace()).toBeNull()
        })
      })

      it('should handle null store gracefully', () => {
        resetContextNamespace()
        // Should not throw
      })
    })
  })

  describe('request context', () => {
    describe('getContextNextApiRequest / setContextNextApiRequest', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const request = getContextNextApiRequest()

          expect(request).toBeUndefined()
        })
      })

      it('should store and retrieve Next API request', async () => {
        await executeInContext(async () => {
          const mockRequest = { url: '/test' }

          setContextNextApiRequest(mockRequest)

          const retrieved = getContextNextApiRequest()

          expect(retrieved).toBe(mockRequest)
        })
      })
    })

    describe('getContextNextApiResponse / setContextNextApiResponse', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const response = getContextNextApiResponse()

          expect(response).toBeUndefined()
        })
      })

      it('should store and retrieve Next API response', async () => {
        await executeInContext(async () => {
          const mockResponse = { status: jest.fn() }

          setContextNextApiResponse(mockResponse)

          const retrieved = getContextNextApiResponse()

          expect(retrieved).toBe(mockResponse)
        })
      })
    })

    describe('getContextRequest / setContextRequest', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const request = getContextRequest()

          expect(request).toBeUndefined()
        })
      })

      it('should store and retrieve Request object', async () => {
        await executeInContext(async () => {
          const mockRequest = new Request('https://example.com/test')

          setContextRequest(mockRequest)

          const retrieved = getContextRequest()

          expect(retrieved).toBe(mockRequest)
        })
      })
    })

    describe('getContextRequestHost / setContextRequestHost', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const host = getContextRequestHost()

          expect(host).toBeUndefined()
        })
      })

      it('should store and retrieve request host', async () => {
        await executeInContext(async () => {
          setContextRequestHost('example.com')

          const retrieved = getContextRequestHost()

          expect(retrieved).toBe('example.com')
        })
      })
    })

    describe('injected service hosts', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          expect(getContextAPIHost()).toBeUndefined()
          expect(getContextStaticHost()).toBeUndefined()
          expect(getContextWidgetHost()).toBeUndefined()
        })
      })

      it('should store and retrieve service hosts', async () => {
        await executeInContext(async () => {
          setContextAPIHost('api.example.com')
          setContextStaticHost('static.example.com')
          setContextWidgetHost('widgets.example.com')

          expect(getContextAPIHost()).toBe('api.example.com')
          expect(getContextStaticHost()).toBe('static.example.com')
          expect(getContextWidgetHost()).toBe('widgets.example.com')
        })
      })
    })

    describe('getContextRequestIpAddress / setContextRequestIpAddress', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const ip = getContextRequestIpAddress()

          expect(ip).toBeUndefined()
        })
      })

      it('should store and retrieve IP address', async () => {
        await executeInContext(async () => {
          setContextRequestIpAddress('192.168.1.1')

          const retrieved = getContextRequestIpAddress()

          expect(retrieved).toBe('192.168.1.1')
        })
      })
    })

    describe('getContextRequestProtocol / setContextRequestProtocol', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          expect(getContextRequestProtocol()).toBeUndefined()
        })
      })

      it('should store and retrieve the request protocol', async () => {
        await executeInContext(async () => {
          setContextRequestProtocol('https')

          expect(getContextRequestProtocol()).toBe('https')
        })
      })
    })

    describe('getContextRequestUserAgent / setContextRequestUserAgent', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const userAgent = getContextRequestUserAgent()

          expect(userAgent).toBeUndefined()
        })
      })

      it('should store and retrieve user agent', async () => {
        await executeInContext(async () => {
          setContextRequestUserAgent('Mozilla/5.0')

          const retrieved = getContextRequestUserAgent()

          expect(retrieved).toBe('Mozilla/5.0')
        })
      })
    })

    describe('getContextRequestQuery / setContextRequestQuery', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const query = getContextRequestQuery()

          expect(query).toBeUndefined()
        })
      })

      it('should store and retrieve query parameters', async () => {
        await executeInContext(async () => {
          const queryParams = { foo: 'bar', baz: ['1', '2'] }

          setContextRequestQuery(queryParams)

          const retrieved = getContextRequestQuery()

          expect(retrieved).toEqual(queryParams)
        })
      })
    })
  })

  describe('endpoint configuration', () => {
    describe('getContextFrontendHost / setContextFrontendHost', () => {
      it('should return undefined when not set', async () => {
        await executeInContext(async () => {
          const host = getContextFrontendHost()

          expect(host).toBeUndefined()
        })
      })

      it('should store and retrieve frontend host', async () => {
        await executeInContext(async () => {
          setContextFrontendHost('frontend.example.com')

          const retrieved = getContextFrontendHost()

          expect(retrieved).toBe('frontend.example.com')
        })
      })
    })
  })

  describe('entity context', () => {
    describe('getContextUser / setContextUser', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const user = getContextUser()

          expect(user).toBeNull()
        })
      })

      it('should store and retrieve user', async () => {
        await executeInContext(async () => {
          const mockUser = { id: 'user-123', email: 'test@example.com' }

          setContextUser(mockUser)

          const retrieved = getContextUser()

          expect(retrieved).toEqual(mockUser)
        })
      })

      it('should handle user without id', async () => {
        await executeInContext(async () => {
          const mockUser = { email: 'test@example.com' }

          setContextUser(mockUser)

          const retrieved = getContextUser()

          expect(retrieved).toEqual(mockUser)
        })
      })
    })

    describe('getContextConversation / setContextConversation', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const conversation = getContextConversation()

          expect(conversation).toBeNull()
        })
      })

      it('should store and retrieve conversation', async () => {
        await executeInContext(async () => {
          const mockConversation = { id: 'conv-123', userId: 'user-123' }

          setContextConversation(mockConversation)

          const retrieved = getContextConversation()

          expect(retrieved).toEqual(mockConversation)
        })
      })
    })

    describe('getContextContact / setContextContact / resetContextContact', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const contact = getContextContact()

          expect(contact).toBeNull()
        })
      })

      it('should store and retrieve contact', async () => {
        await executeInContext(async () => {
          const mockContact = {
            id: 'contact-123',
            email: 'contact@example.com',
          }

          setContextContact(mockContact)

          const retrieved = getContextContact()

          expect(retrieved).toEqual(mockContact)
        })
      })

      it('should reset contact to null', async () => {
        await executeInContext(async () => {
          const mockContact = { id: 'contact-123' }

          setContextContact(mockContact)
          expect(getContextContact()).toEqual(mockContact)

          resetContextContact()
          expect(getContextContact()).toBeNull()
        })
      })
    })

    describe('getContextBot / setContextBot', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const bot = getContextBot()

          expect(bot).toBeNull()
        })
      })

      it('should store and retrieve bot', async () => {
        await executeInContext(async () => {
          const mockBot = { id: 'bot-123', name: 'Test Bot' }

          setContextBot(mockBot)

          const retrieved = getContextBot()

          expect(retrieved).toEqual(mockBot)
        })
      })
    })

    describe('getContextTimezone / setContextTimezone', () => {
      it('should return null when not set', async () => {
        await executeInContext(async () => {
          const timezone = getContextTimezone()

          expect(timezone).toBeNull()
        })
      })

      it('should store and retrieve timezone', async () => {
        await executeInContext(async () => {
          setContextTimezone('America/New_York')

          const retrieved = getContextTimezone()

          expect(retrieved).toBe('America/New_York')
        })
      })

      it('should handle null timezone', async () => {
        await executeInContext(async () => {
          setContextTimezone('UTC')
          expect(getContextTimezone()).toBe('UTC')

          setContextTimezone(null)
          expect(getContextTimezone()).toBeNull()
        })
      })
    })
  })

  describe('edge cases', () => {
    it('should handle multiple context values set together', async () => {
      await executeInContext(async () => {
        setContextUser({ id: 'user-1' })
        setContextBot({ id: 'bot-1' })
        setContextNamespace('test-ns')
        setContextRequestHost('example.com')

        expect(getContextUser()).toEqual({ id: 'user-1' })
        expect(getContextBot()).toEqual({ id: 'bot-1' })
        expect(getContextNamespace()).toBe('test-ns')
        expect(getContextRequestHost()).toBe('example.com')
      })
    })

    it('should share context in nested execution', async () => {
      await executeInContext(async () => {
        setContextNamespace('outer')

        await executeInContext(async () => {
          expect(getContextNamespace()).toBe('outer')
          setContextNamespace('inner')
          expect(getContextNamespace()).toBe('inner')
        })

        expect(getContextNamespace()).toBe('inner')
      })
    })
  })
})
