/* eslint-disable @typescript-eslint/no-require-imports */
let mockRelayBaseUrl

jest.mock('@chatbotkit-dev/relay', () => ({
  __esModule: true,
  default: {
    channelUrl: jest.fn((channelId, side, options = {}) => {
      const url = new URL(
        `/channel/${encodeURIComponent(channelId)}`,
        mockRelayBaseUrl
      )

      url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
      url.searchParams.set('side', side)

      if (options.events) {
        url.searchParams.set('events', '1')
      }

      return url.toString()
    }),
  },
}))

describe('realtime.session', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockRelayBaseUrl = 'https://relay.example.com'
  })

  it('should create channel ids using two cuid values', () => {
    jest.doMock('@/lib/cuid', () => ({
      __esModule: true,
      default: jest
        .fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second'),
    }))

    const { createRealtimeRelayChannelId } = require('./realtime.session')

    expect(createRealtimeRelayChannelId()).toBe('realtime-first-second')
  })

  it('should build ws url from http base url with side parameter', () => {
    mockRelayBaseUrl = 'http://relay.example.com'

    const { createRealtimeRelayChannelUrl } = require('./realtime.session')

    expect(createRealtimeRelayChannelUrl('channel-id', 'client')).toBe(
      'ws://relay.example.com/channel/channel-id?side=client'
    )
  })

  it('should build wss url from https base url and include events flag', () => {
    const { createRealtimeRelayChannelUrl } = require('./realtime.session')

    expect(
      createRealtimeRelayChannelUrl('channel-id', 'server', { events: true })
    ).toBe('wss://relay.example.com/channel/channel-id?side=server&events=1')
  })

  it('should url-encode channel id in channel url', () => {
    const { createRealtimeRelayChannelUrl } = require('./realtime.session')

    expect(createRealtimeRelayChannelUrl('a/b c', 'client')).toBe(
      'wss://relay.example.com/channel/a%2Fb%20c?side=client'
    )
  })
})
