import { RealtimeSocket } from '@/lib/realtime.client'

describe('RealtimeSocket', () => {
  it('dispatches parsed message events to subscribers', () => {
    let messageHandler
    const socket = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn((type, handler) => {
        if (type === 'message') {
          messageHandler = handler
        }
      }),
      removeEventListener: jest.fn(),
    }

    const realtimeSocket = new RealtimeSocket(socket)
    const onEvent = jest.fn()

    realtimeSocket.onEvent(onEvent)

    messageHandler({
      data: JSON.stringify({ type: 'completeEnd', data: { id: 'x' } }),
    })

    expect(onEvent).toHaveBeenCalledWith({
      type: 'completeEnd',
      data: { id: 'x' },
    })
  })

  it('ignores malformed socket messages', () => {
    let messageHandler
    const socket = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn((type, handler) => {
        if (type === 'message') {
          messageHandler = handler
        }
      }),
      removeEventListener: jest.fn(),
    }

    const realtimeSocket = new RealtimeSocket(socket)
    const onEvent = jest.fn()

    realtimeSocket.onEvent(onEvent)

    messageHandler({ data: 'not-json' })

    expect(onEvent).not.toHaveBeenCalled()
  })

  it('serializes commands through send and helper methods', () => {
    const socket = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }

    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.complete()
    realtimeSocket.initiate('hello', { modality: 'audio' })
    realtimeSocket.abort()

    expect(socket.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: 'complete' })
    )
    expect(socket.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        type: 'initiate',
        data: { text: 'hello', modality: 'audio' },
      })
    )
    expect(socket.send).toHaveBeenNthCalledWith(
      3,
      JSON.stringify({ type: 'abort' })
    )
  })

  it('removes listeners and clears handlers on dispose', () => {
    let messageHandler
    const socket = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn((type, handler) => {
        if (type === 'message') {
          messageHandler = handler
        }
      }),
      removeEventListener: jest.fn(),
    }

    const realtimeSocket = new RealtimeSocket(socket)
    const onEvent = jest.fn()

    realtimeSocket.onEvent(onEvent)
    realtimeSocket.dispose()

    expect(socket.removeEventListener).toHaveBeenCalledWith(
      'message',
      messageHandler
    )

    messageHandler({ data: JSON.stringify({ type: 'completeEnd' }) })

    expect(onEvent).not.toHaveBeenCalled()
  })

  describe('steer command', () => {
    it('sends steer command with text', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.steer('redirect the conversation')

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'steer',
          data: { text: 'redirect the conversation' },
        })
      )
    })

    it('sends steer command with modality and voice options', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.steer('change topic', { modality: 'audio', voice: 'alloy' })

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'steer',
          data: { text: 'change topic', modality: 'audio', voice: 'alloy' },
        })
      )
    })
  })

  describe('audio command', () => {
    it('sends audio command with PCM16 data', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      const audioData = {
        data: 'base64encodedpcmdata==',
        format: { encoding: 'pcm16', sampleRate: 16000, channels: 1 },
      }

      rs.audio(audioData)

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'audio', data: audioData })
      )
    })
  })

  describe('complete command variants', () => {
    it('sends complete with text when text is provided', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.complete('hello world')

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'complete', data: { text: 'hello world' } })
      )
    })

    it('sends complete with text, modality and voice when all options provided', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.complete('speak this', { modality: 'audio', voice: 'alloy' })

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'complete',
          data: { text: 'speak this', modality: 'audio', voice: 'alloy' },
        })
      )
    })

    it('sends complete with data from options when text is undefined but options provided', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.complete(undefined, { modality: 'audio' })

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'complete', data: { modality: 'audio' } })
      )
    })

    it('sends complete without data when no text and no options', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.complete()

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'complete' })
      )
    })
  })

  describe('readyState getter', () => {
    it('proxies readyState from the underlying socket', () => {
      const socket = {
        readyState: 3,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      expect(rs.readyState).toBe(3)
    })
  })

  describe('close method', () => {
    it('delegates to the underlying socket close', () => {
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const rs = new RealtimeSocket(socket)

      rs.close()

      expect(socket.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('Node.js on/off style socket', () => {
    it('registers message listener via .on() when addEventListener is absent', () => {
      let dataHandler
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn((type, handler) => {
          if (type === 'message') {
            dataHandler = handler
          }
        }),
        off: jest.fn(),
      }

      const rs = new RealtimeSocket(socket)
      const onEvent = jest.fn()

      rs.onEvent(onEvent)

      // @note .on style receives raw data, not a wrapped event object
      dataHandler(JSON.stringify({ type: 'token', data: 'hello' }))

      expect(onEvent).toHaveBeenCalledWith({ type: 'token', data: 'hello' })
    })

    it('unregisters via .off() on dispose when addEventListener is absent', () => {
      let dataHandler
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn((type, handler) => {
          if (type === 'message') {
            dataHandler = handler
          }
        }),
        off: jest.fn(),
      }

      const rs = new RealtimeSocket(socket)
      const onEvent = jest.fn()

      rs.onEvent(onEvent)
      rs.dispose()

      expect(socket.off).toHaveBeenCalledWith('message', dataHandler)

      // @note after dispose, further messages must not invoke handlers
      dataHandler(JSON.stringify({ type: 'token' }))
      expect(onEvent).not.toHaveBeenCalled()
    })
  })

  describe('URL string constructor', () => {
    it('instantiates the provided WebSocket constructor with the URL', () => {
      const mockSocketInstance = {
        readyState: 0,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const MockWebSocket = jest.fn().mockReturnValue(mockSocketInstance)

      const rs = new RealtimeSocket('wss://example.com/realtime', {
        WebSocket: MockWebSocket,
      })

      expect(MockWebSocket).toHaveBeenCalledWith('wss://example.com/realtime')
      expect(rs.readyState).toBe(0)
    })

    it('accepts a URL instance in addition to a string', () => {
      const mockSocketInstance = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
      const MockWebSocket = jest.fn().mockReturnValue(mockSocketInstance)
      const url = new URL('wss://example.com/realtime')

      new RealtimeSocket(url, { WebSocket: MockWebSocket })

      expect(MockWebSocket).toHaveBeenCalledWith(url)
    })

    it('throws when no WebSocket constructor is provided or available globally', () => {
      const savedWebSocket = global.WebSocket

      // @note setting to undefined (not deleting) so the ?? chain completes and
      // the custom error message is thrown rather than a ReferenceError
      global.WebSocket = undefined

      try {
        expect(() => new RealtimeSocket('wss://example.com')).toThrow(
          'WebSocket constructor is not available'
        )
      } finally {
        global.WebSocket = savedWebSocket
      }
    })
  })

  describe('multiple handlers', () => {
    it('delivers the same event to all registered handlers', () => {
      let messageHandler
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn((type, handler) => {
          if (type === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      const rs = new RealtimeSocket(socket)
      const handlerA = jest.fn()
      const handlerB = jest.fn()
      const handlerC = jest.fn()

      rs.onEvent(handlerA)
      rs.onEvent(handlerB)
      rs.onEvent(handlerC)

      messageHandler({ data: JSON.stringify({ type: 'token', data: 'hi' }) })

      expect(handlerA).toHaveBeenCalledWith({ type: 'token', data: 'hi' })
      expect(handlerB).toHaveBeenCalledWith({ type: 'token', data: 'hi' })
      expect(handlerC).toHaveBeenCalledWith({ type: 'token', data: 'hi' })
    })
  })

  describe('onEvent deregistration', () => {
    it('stops delivering events after the returned unsubscribe function is called', () => {
      let messageHandler
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn((type, handler) => {
          if (type === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      const rs = new RealtimeSocket(socket)
      const onEvent = jest.fn()

      const unsubscribe = rs.onEvent(onEvent)

      messageHandler({ data: JSON.stringify({ type: 'token', data: 'first' }) })

      unsubscribe()

      messageHandler({
        data: JSON.stringify({ type: 'token', data: 'second' }),
      })

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith({ type: 'token', data: 'first' })
    })
  })

  describe('Buffer message handling', () => {
    it('parses messages delivered as Buffer objects', () => {
      let messageHandler
      const socket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn((type, handler) => {
          if (type === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      const rs = new RealtimeSocket(socket)
      const onEvent = jest.fn()

      rs.onEvent(onEvent)

      const payload = { type: 'completeEnd', data: { done: true } }

      // @note simulate Node.js ws library which sends Buffer objects
      messageHandler({
        data: Buffer.from(JSON.stringify(payload), 'utf8'),
      })

      expect(onEvent).toHaveBeenCalledWith(payload)
    })
  })
})
