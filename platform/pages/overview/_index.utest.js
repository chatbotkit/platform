import {
  CHANNEL_SCAN,
  PROJECT_SETUP_CHANNEL_KINDS,
  buildChannelsQuery,
  buildProjectSetupQuery,
  deriveChannels,
  deriveProjectSetup,
} from './index'

// @note the setup model under test is pure, but it lives in the page module,
// which pulls server-only data sources for getServerSideProps (redis via
// @/lib/limit.core) and ships lucide-react as ESM the jest transform does not
// take. Neither is exercised here, so both are stubbed to let the module load.
// The credential table (@/lib/integration.verification) is pure and loads for
// real - the query and the derivation depend on it.
jest.mock('lucide-react', () => ({}))
jest.mock('@/lib/limit.core', () => ({ getUserDisplayLimits: jest.fn() }))
jest.mock('@/lib/usage.get', () => ({ getUsage: jest.fn() }))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/partner.helpers', () => ({ getPartnerByHostname: jest.fn() }))

function build({ secrets = [], ...channels } = {}) {
  return {
    secrets: { edges: secrets.map((node) => ({ node })) },
    ...Object.fromEntries(
      Object.entries(channels).map(([connection, nodes]) => [
        connection,
        { edges: nodes.map((node) => ({ node })) },
      ])
    ),
  }
}

function authenticated(overrides = {}) {
  return {
    id: 'se1',
    name: 'Payment provider key',
    type: 'plain',
    verification: { status: 'authenticated' },
    ...overrides,
  }
}

function unauthenticated(overrides = {}) {
  return {
    id: 'se2',
    name: 'Notion token',
    type: 'plain',
    verification: { status: 'unauthenticated' },
    ...overrides,
  }
}

// @note mirrors what the graph returns: a configured integration offers no
// action, an unconfigured one carries the install route
function integration(type, id, name, status = 'unconfigured') {
  return {
    id,
    name,
    verification: {
      status,
      action:
        status === 'configured'
          ? null
          : { type: 'install', url: `/integrations/${type}/${id}` },
    },
  }
}

describe('PROJECT_SETUP_CHANNEL_KINDS', () => {
  it('covers only the channels that carry credentials', () => {
    const types = PROJECT_SETUP_CHANNEL_KINDS.map(({ type }) => type)

    expect(types).toContain('slack')
    expect(types).toContain('twilio')

    // @note widget and email have no credentials of their own, so they are
    // always configured and would only ever be noise on the checklist
    expect(types).not.toContain('widget')
    expect(types).not.toContain('email')
  })
})

describe('buildProjectSetupQuery', () => {
  const query = buildProjectSetupQuery('bp1')

  it('scopes every connection to the blueprint', () => {
    expect(query).toContain('blueprintIds: ["bp1"]')
    expect(query).toContain(
      'slackIntegrations(first: 25, blueprintIds: ["bp1"])'
    )
  })

  it('asks only for shared secrets', () => {
    // @note verifying a personal secret outside a contact context makes the
    // resolver throw, which would take the whole query down
    expect(query).toContain('kind: [shared]')
  })

  it('asks the graph to verify secrets and integrations', () => {
    expect([...query.matchAll(/verification \{/g)]).toHaveLength(
      1 + PROJECT_SETUP_CHANNEL_KINDS.length
    )
  })

  it('asks for the install action on integrations, but not on secrets', () => {
    // @note a secret links to its own page, which handles every secret type;
    // an integration links to the install route the graph hands back. So only
    // the integrations carry an action in the query.
    const secretsBlock = query.slice(0, query.indexOf('slackIntegrations'))

    expect(secretsBlock).not.toContain('action')
    expect([...query.matchAll(/action \{\s*type\s*url/g)]).toHaveLength(
      PROJECT_SETUP_CHANNEL_KINDS.length
    )
  })

  it('does not ask credential free channels whether they are configured', () => {
    expect(query).not.toContain('widgetIntegrations')
    expect(query).not.toContain('emailIntegrations')
  })
})

describe('buildChannelsQuery', () => {
  it('scopes every connection to the blueprint', () => {
    const query = buildChannelsQuery('bp1')

    expect(query).toContain(
      `widgetIntegrations(first: ${CHANNEL_SCAN}, blueprintIds: ["bp1"])`
    )
    expect(query).toContain(
      `slackIntegrations(first: ${CHANNEL_SCAN}, blueprintIds: ["bp1"])`
    )
  })

  it('asks every kind for enough to tell one channel from many', () => {
    expect(CHANNEL_SCAN).toBeGreaterThan(1)

    expect(buildChannelsQuery(null)).toContain(
      `widgetIntegrations(first: ${CHANNEL_SCAN})`
    )
  })
})

describe('deriveChannels', () => {
  it('reports a project without channels as empty', () => {
    const { channel, count } = deriveChannels(build())

    expect(channel).toBe(null)
    expect(count).toBe(0)
  })

  it('leads with the highest priority channel', () => {
    // @note slack outranks telegram in CHANNEL_KINDS, whatever the response
    // order is
    const { channel, count } = deriveChannels(
      build({
        telegramIntegrations: [integration('telegram', 'ti1', 'Telegram')],
        slackIntegrations: [integration('slack', 'si1', 'Slack')],
      })
    )

    expect(channel.type).toBe('slack')
    expect(channel.integration.id).toBe('si1')
    expect(count).toBe(2)
  })

  it('counts a project that ships one channel as one', () => {
    const { channel, count } = deriveChannels(
      build({ widgetIntegrations: [integration('widget', 'wi1', 'Widget')] })
    )

    expect(channel.type).toBe('widget')
    expect(count).toBe(1)
  })

  it('counts a second channel of the same kind', () => {
    // @note two widgets are two channels - the leading one is no more the
    // project than the other is
    const { count } = deriveChannels(
      build({
        widgetIntegrations: [
          integration('widget', 'wi1', 'Site'),
          integration('widget', 'wi2', 'Docs'),
        ],
      })
    )

    expect(count).toBe(2)
  })

  it('survives a response with nothing in it', () => {
    expect(() => deriveChannels(null)).not.toThrow()

    expect(deriveChannels(null)).toEqual({ channel: null, count: 0 })
    expect(deriveChannels({})).toEqual({ channel: null, count: 0 })
  })
})

describe('deriveProjectSetup', () => {
  it('reports a project with nothing to authenticate as complete', () => {
    const setup = deriveProjectSetup(build())

    expect(setup.items).toHaveLength(0)
    expect(setup.complete).toBe(true)
  })

  it('reports an authenticated project as complete', () => {
    const setup = deriveProjectSetup(
      build({
        secrets: [authenticated()],
        slackIntegrations: [integration('slack', 'si1', 'Slack', 'configured')],
      })
    )

    expect(setup.complete).toBe(true)
    expect(setup.doneCount).toBe(2)
  })

  it('flags an unauthenticated secret', () => {
    const setup = deriveProjectSetup(build({ secrets: [unauthenticated()] }))

    expect(setup.complete).toBe(false)
    expect(setup.doneCount).toBe(0)

    const [item] = setup.items

    expect(item.kind).toBe('secret')
    expect(item.name).toBe('Notion token')
    expect(item.done).toBe(false)
    expect(item.caption).toBe('Authenticate')
  })

  it('links every secret to its own page, whatever its type', () => {
    // @note the secret page is where a secret is authenticated, for any type -
    // so it is the one destination that always works, and it does not rot the
    // way a signed manager url does. The prompt reads the same for all types.
    const plain = deriveProjectSetup(build({ secrets: [unauthenticated()] }))

    expect(plain.items[0].caption).toBe('Authenticate')
    expect(plain.items[0].link).toBe('/secrets/se2')

    const oauth = deriveProjectSetup(
      build({ secrets: [unauthenticated({ type: 'oauth' })] })
    )

    expect(oauth.items[0].caption).toBe('Authenticate')
    expect(oauth.items[0].link).toBe('/secrets/se2')
  })

  it('flags an integration the clone left without its tokens', () => {
    const setup = deriveProjectSetup(
      build({
        slackIntegrations: [integration('slack', 'si1', 'Support')],
      })
    )

    expect(setup.complete).toBe(false)

    const [item] = setup.items

    expect(item.kind).toBe('integration')
    expect(item.name).toBe('Support')
    expect(item.caption).toBe('Install')
    expect(item.link).toBe('/integrations/slack/si1')
    expect(item.description).toContain('Slack')
  })

  it('names an unnamed integration after its channel', () => {
    const setup = deriveProjectSetup(
      build({
        twilioIntegrations: [integration('twilio', 'ti1', null)],
      })
    )

    expect(setup.items[0].name).toBe('Twilio')
  })

  it('lists every unauthenticated resource, not just the first', () => {
    const setup = deriveProjectSetup(
      build({
        secrets: [authenticated(), unauthenticated()],
        slackIntegrations: [integration('slack', 'si1', 'Slack')],
        twilioIntegrations: [integration('twilio', 'ti1', 'Twilio')],
      })
    )

    expect(setup.items).toHaveLength(4)
    expect(setup.doneCount).toBe(1)
    expect(setup.complete).toBe(false)

    expect(
      setup.items.filter(({ done }) => !done).map(({ key }) => key)
    ).toEqual(['secret:se2', 'slack:si1', 'twilio:ti1'])
  })

  it('leads with secrets, which fail silently, over integrations, which do not', () => {
    const setup = deriveProjectSetup(
      build({
        secrets: [unauthenticated()],
        slackIntegrations: [integration('slack', 'si1', 'Slack')],
      })
    )

    expect(setup.items.map(({ kind }) => kind)).toEqual([
      'secret',
      'integration',
    ])
  })

  it('survives a response with nothing in it', () => {
    expect(() => deriveProjectSetup(null)).not.toThrow()
    expect(() => deriveProjectSetup({})).not.toThrow()

    expect(deriveProjectSetup(null).items).toEqual([])
  })
})
