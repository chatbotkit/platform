import handler from './list'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor:
    (fn) =>
    async (req = {}) =>
      fn(req.query?.cursor || null),
}))

jest.mock('@/data/secrets/visible', () => ({
  __esModule: true,
  default: {
    'slack[bot]': {
      name: 'Slack Bot Token',
      description: 'Bot token for Slack workspace access.',
      type: 'bearer',
      kind: 'shared',
      icon: '@logo/slack.com',
      tags: ['slack', 'messaging'],
      setup: 'Create a Slack app and get the bot token.',
      commentary: null,
    },
    'google/calendar': {
      name: 'Google Calendar',
      description: 'OAuth credentials for Google Calendar.',
      type: 'oauth',
      kind: 'personal',
      config: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'https://www.googleapis.com/auth/calendar',
      },
      icon: '@logo/google.com',
      tags: ['google', 'calendar'],
      setup: null,
      commentary: null,
    },
  },
}))

describe('/api/v1/platform/secret/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const response = await handler({ query: { cursor: 'next-page' } })

    expect(response).toEqual({ items: [] })
  })

  it('returns all secrets when no cursor is provided', async () => {
    const response = await handler({ query: {} })

    expect(Array.isArray(response.items)).toBe(true)
    expect(response.items).toHaveLength(2)
  })

  it('converts template key to kebab-case id', async () => {
    const response = await handler({ query: {} })

    const slackItem = response.items.find(
      (item) => item.template === 'slack[bot]'
    )

    expect(slackItem).toBeDefined()
    expect(slackItem.id).toBe('slack-bot')
  })

  it('converts slash-separated template key to kebab-case id', async () => {
    const response = await handler({ query: {} })

    const googleItem = response.items.find(
      (item) => item.template === 'google/calendar'
    )

    expect(googleItem).toBeDefined()
    expect(googleItem.id).toBe('google-calendar')
  })

  it('preserves all metadata fields in each item', async () => {
    const response = await handler({ query: {} })

    const slackItem = response.items.find(
      (item) => item.template === 'slack[bot]'
    )

    expect(slackItem).toMatchObject({
      id: 'slack-bot',
      template: 'slack[bot]',
      name: 'Slack Bot Token',
      description: 'Bot token for Slack workspace access.',
      type: 'bearer',
      kind: 'shared',
      icon: '@logo/slack.com',
      tags: ['slack', 'messaging'],
      setup: 'Create a Slack app and get the bot token.',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })

  it('passes OAuth config through for oauth-type secrets', async () => {
    const response = await handler({ query: {} })

    const googleItem = response.items.find(
      (item) => item.template === 'google/calendar'
    )

    expect(googleItem.config).toMatchObject({
      authorizationUrl: expect.any(String),
      tokenUrl: expect.any(String),
    })
  })

  it('throws when a secret config exposes clientId', async () => {
    jest.resetModules()

    jest.doMock('@/data/secrets/visible', () => ({
      __esModule: true,
      default: {
        'bad/oauth': {
          name: 'Leaky OAuth',
          description: 'This one leaks clientId.',
          type: 'oauth',
          kind: 'shared',
          // @note clientId in config is a security violation - the handler asserts against it
          config: { clientId: 'LEAKED_CLIENT_ID' },
          icon: null,
          tags: [],
        },
      },
    }))

    const freshHandler = (await import('./list')).default

    await expect(freshHandler({ query: {} })).rejects.toThrow(
      'secret config should not expose clientId'
    )

    jest.resetModules()
  })

  it('throws when a secret config exposes clientSecret', async () => {
    jest.resetModules()

    jest.doMock('@/data/secrets/visible', () => ({
      __esModule: true,
      default: {
        'bad/oauth': {
          name: 'Leaky OAuth',
          description: 'This one leaks clientSecret.',
          type: 'oauth',
          kind: 'shared',
          config: { clientSecret: 'LEAKED_SECRET' },
          icon: null,
          tags: [],
        },
      },
    }))

    const freshHandler = (await import('./list')).default

    await expect(freshHandler({ query: {} })).rejects.toThrow(
      'secret config should not expose clientSecret'
    )

    jest.resetModules()
  })

  it('throws when a secret config exposes password', async () => {
    jest.resetModules()

    jest.doMock('@/data/secrets/visible', () => ({
      __esModule: true,
      default: {
        'bad/basic': {
          name: 'Basic Auth',
          description: 'Leaks password.',
          type: 'plain',
          kind: 'shared',
          config: { password: 'hunter2' },
          icon: null,
          tags: [],
        },
      },
    }))

    const freshHandler = (await import('./list')).default

    await expect(freshHandler({ query: {} })).rejects.toThrow(
      'secret config should not expose password'
    )

    jest.resetModules()
  })

  it('throws when a secret config exposes pass', async () => {
    jest.resetModules()

    jest.doMock('@/data/secrets/visible', () => ({
      __esModule: true,
      default: {
        'bad/pass': {
          name: 'Pass Secret',
          description: 'Leaks pass.',
          type: 'plain',
          kind: 'shared',
          config: { pass: 'secret123' },
          icon: null,
          tags: [],
        },
      },
    }))

    const freshHandler = (await import('./list')).default

    await expect(freshHandler({ query: {} })).rejects.toThrow(
      'secret config should not expose password'
    )

    jest.resetModules()
  })

  it('does not throw for secrets with no config', async () => {
    const response = await handler({ query: {} })

    const slackItem = response.items.find(
      (item) => item.template === 'slack[bot]'
    )

    expect(slackItem).toBeDefined()
    // If we get here without throwing, the assertion did not fire
  })

  it('does not throw for OAuth secrets with only safe config fields', async () => {
    const response = await handler({ query: {} })

    const googleItem = response.items.find(
      (item) => item.template === 'google/calendar'
    )

    expect(googleItem).toBeDefined()
    // authorizationUrl and tokenUrl are safe to expose
  })
})
