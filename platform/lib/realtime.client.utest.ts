import {
  RealtimeClient,
  type RealtimeClientAudioInput,
  type RealtimeClientAudioOutput,
  RealtimeSocket,
  type RealtimeSocketLike,
} from '@/lib/realtime.client'

import { EventEmitter } from 'events'

class MockSocket extends EventEmitter implements RealtimeSocketLike {
  readyState = 1
  sent: unknown[] = []
  closed = false

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.closed = true
  }

  addEventListener(
    type: 'message',
    handler: (event: { data: unknown }) => void
  ): void {
    this.on(type, handler)
  }

  removeEventListener(
    type: 'message',
    handler: (event: { data: unknown }) => void
  ): void {
    this.off(type, handler)
  }
}

describe('RealtimeClient', () => {
  it('exports RealtimeSocket for callers that need the transport type', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    expect(realtimeSocket.readyState).toBe(1)
  })

  it('forwards response-producing commands to the underlying socket', () => {
    const socket = new MockSocket()
    const client = new RealtimeClient(socket)

    client.complete('hello', { modality: 'audio', voice: 'marin' })
    client.steer('turn')
    client.abort()

    expect(socket.sent).toEqual([
      {
        type: 'complete',
        data: { text: 'hello', modality: 'audio', voice: 'marin' },
      },
      {
        type: 'steer',
        data: { text: 'turn' },
      },
      {
        type: 'abort',
      },
    ])
  })

  it('normalizes event.output payloads and routes audio plus completeBegin to the audio output', () => {
    const socket = new MockSocket()
    const client = new RealtimeClient(socket)
    const output: RealtimeClientAudioOutput = {
      write: jest.fn(),
      reset: jest.fn(),
      dispose: jest.fn(),
    }
    const handler = jest.fn()

    client.attachAudioOutput(output)
    client.onEvent(handler)

    socket.emit('message', {
      data: JSON.stringify({
        type: 'event.output',
        data: {
          type: 'completeBegin',
          data: {
            instance: 'in_1',
            iteration: 'it_1',
          },
          createdAt: 1,
        },
      }),
    })

    socket.emit('message', {
      data: JSON.stringify({
        type: 'event.output',
        data: {
          type: 'audio',
          data: {
            data: 'base64-audio',
            format: {
              encoding: 'pcm16',
              sampleRate: 24000,
              channels: 1,
            },
          },
          createdAt: 2,
        },
      }),
    })

    expect(output.reset).toHaveBeenCalledTimes(1)
    expect(output.write).toHaveBeenCalledWith({
      data: 'base64-audio',
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    })
    expect(handler).toHaveBeenCalledWith({
      type: 'completeBegin',
      data: {
        instance: 'in_1',
        iteration: 'it_1',
      },
      createdAt: 1,
    })
  })

  it('attaches a microphone input and forwards microphone audio into socket.audio', async () => {
    const socket = new MockSocket()
    const client = new RealtimeClient(socket)
    const input: RealtimeClientAudioInput = {
      attach: jest.fn((send) => {
        send({
          data: 'mic-audio',
          format: {
            encoding: 'pcm16',
            sampleRate: 24000,
            channels: 1,
          },
        })
      }),
      detach: jest.fn(),
      dispose: jest.fn(),
    }

    await client.attachMic(input)

    expect(input.attach).toHaveBeenCalledTimes(1)
    expect(socket.sent).toEqual([
      {
        type: 'audio',
        data: {
          data: 'mic-audio',
          format: {
            encoding: 'pcm16',
            sampleRate: 24000,
            channels: 1,
          },
        },
      },
    ])
  })

  it('detaches audio attachments on dispose', async () => {
    const socket = new MockSocket()
    const client = new RealtimeClient(socket)
    const input: RealtimeClientAudioInput = {
      attach: jest.fn(),
      detach: jest.fn(),
      dispose: jest.fn(),
    }
    const output: RealtimeClientAudioOutput = {
      write: jest.fn(),
      reset: jest.fn(),
      dispose: jest.fn(),
    }

    client.attachAudioOutput(output)
    await client.attachMic(input)
    client.dispose()

    expect(input.detach).toHaveBeenCalledTimes(1)
    expect(input.dispose).toHaveBeenCalledTimes(1)
    expect(output.reset).toHaveBeenCalledTimes(1)
    expect(output.dispose).toHaveBeenCalledTimes(1)
    expect(socket.closed).toBe(true)
  })
})

describe('RealtimeSocket', () => {
  it('sends complete commands without text', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.complete()

    expect(socket.sent).toEqual([
      {
        type: 'complete',
      },
    ])
  })

  it('sends complete commands with text', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.complete('hello')

    expect(socket.sent).toEqual([
      {
        type: 'complete',
        data: { text: 'hello' },
      },
    ])
  })

  it('sends modality and voice options on response-producing commands', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.complete('hello', { modality: 'audio', voice: 'marin' })
    realtimeSocket.initiate('start', { modality: 'audio', voice: 'cedar' })
    realtimeSocket.steer('turn', { modality: 'text' })

    expect(socket.sent).toEqual([
      {
        type: 'complete',
        data: { text: 'hello', modality: 'audio', voice: 'marin' },
      },
      {
        type: 'initiate',
        data: { text: 'start', modality: 'audio', voice: 'cedar' },
      },
      {
        type: 'steer',
        data: { text: 'turn', modality: 'text' },
      },
    ])
  })

  it('sends initiate, steer, and abort commands', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.initiate('start')
    realtimeSocket.steer('turn')
    realtimeSocket.abort()

    expect(socket.sent).toEqual([
      {
        type: 'initiate',
        data: { text: 'start' },
      },
      {
        type: 'steer',
        data: { text: 'turn' },
      },
      {
        type: 'abort',
      },
    ])
  })

  it('sends audio commands', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)

    realtimeSocket.audio({
      data: 'base64-audio',
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    })

    expect(socket.sent).toEqual([
      {
        type: 'audio',
        data: {
          data: 'base64-audio',
          format: {
            encoding: 'pcm16',
            sampleRate: 24000,
            channels: 1,
          },
        },
      },
    ])
  })

  it('creates a socket from a url', () => {
    const sockets: MockWebSocket[] = []

    class MockWebSocket extends MockSocket {
      constructor(readonly url: string | URL) {
        super()

        sockets.push(this)
      }
    }

    const realtimeSocket = new RealtimeSocket('wss://example.com/realtime', {
      WebSocket: MockWebSocket,
    })

    expect(sockets[0].url).toBe('wss://example.com/realtime')
    expect(realtimeSocket.socket).toBeInstanceOf(MockSocket)
  })

  it('listens for typed realtime events', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)
    const handler = jest.fn()

    realtimeSocket.onEvent(handler)

    socket.emit('message', {
      data: JSON.stringify({
        type: 'result',
        data: {
          id: 'msg-123',
          text: 'hello',
          usage: { token: 1 },
        },
        createdAt: 123,
      }),
    })

    expect(handler).toHaveBeenCalledWith({
      type: 'result',
      data: {
        id: 'msg-123',
        text: 'hello',
        usage: { token: 1 },
      },
      createdAt: 123,
    })
  })

  it('can unsubscribe from events', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)
    const handler = jest.fn()

    const unsubscribe = realtimeSocket.onEvent(handler)

    unsubscribe()

    socket.emit(
      'message',
      JSON.stringify({
        type: 'result',
        data: {},
        createdAt: 123,
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('disposes the socket listener', () => {
    const socket = new MockSocket()
    const realtimeSocket = new RealtimeSocket(socket)
    const handler = jest.fn()

    realtimeSocket.onEvent(handler)
    realtimeSocket.dispose()

    socket.emit(
      'message',
      JSON.stringify({
        type: 'result',
        data: {},
        createdAt: 123,
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })
})
