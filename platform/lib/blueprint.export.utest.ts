/**
 * @jest-environment node
 */
import {
  FULL_EXPORT_BUCKETS,
  JSON_EXPORT_BUCKETS,
  TERRAFORM_EXPORT_BUCKETS,
  exportResourceCategoryMap,
  exportResourceDocument,
  type GroupedBlueprintResources,
} from './blueprint.export'

const grouped: GroupedBlueprintResources = {
  basic: {
    bot: [
      {
        id: 'bot-1',
        name: 'Bot',
        datasetId: 'ds-1',
        botToken: 'should-not-leak',
      },
    ],
    secret: [
      {
        id: 'sec-1',
        name: 'Secret',
        value: 'super-secret',
        config: {
          clientId: 'public-client',
          clientSecret: 'nested-secret',
          password: 'nested-password',
        },
      },
    ],
  },
  object: {
    space: [{ id: 'sp-1', name: 'Space' }],
  },
  compliance: {
    policy: [{ id: 'pol-1', name: 'Policy' }],
  },
  oauth: {
    oAuthConnection: [{ id: 'oa-1', name: 'Connection' }],
  },
  integration: {
    slack: [
      {
        id: 'slk-1',
        name: 'Slack',
        botId: 'bot-1',
        signingSecret: 'sssh',
      },
    ],
    mcpserver: [
      {
        id: 'mcp-1',
        name: 'MCP',
        skillsetId: 'sk-1',
        oAuthConnectionId: 'oa-1',
      },
    ],
  },
}

describe('exportResourceCategoryMap', () => {
  it('groups by category, keeps ids and raw references, strips sensitive fields', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    expect(out.bot).toEqual([
      { id: 'bot-1', name: 'Bot', datasetId: 'ds-1' },
    ])
    expect(out.bot[0]).not.toHaveProperty('botToken')
    expect(out.secret[0]).not.toHaveProperty('value')
    expect(out.secret[0]).not.toHaveProperty('config')
  })

  it('suffixes integration categories with "Integration"', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    expect(out.slackIntegration[0]).toMatchObject({
      name: 'Slack',
      botId: 'bot-1',
    })
    expect(out.slackIntegration[0]).not.toHaveProperty('signingSecret')
    expect(out.slack).toBeUndefined()
  })

  it('includes compliance and omits oauth under the JSON bucket set', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    expect(out.policy).toHaveLength(1)
    expect(out.oAuthConnection).toBeUndefined()
  })

  it('includes policy and oauth under the full bucket set', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'internal',
      buckets: FULL_EXPORT_BUCKETS,
    })

    expect(out.policy).toHaveLength(1)
    expect(out.oAuthConnection).toHaveLength(1)
  })

  it('strips every unmanaged credential field under public sensitivity', () => {
    const withSecrets: GroupedBlueprintResources = {
      integration: {
        slack: [
          {
            id: 'i1',
            name: 'I',
            value: 'v',
            signingSecret: 's',
            botToken: 'bt',
            userToken: 'ut',
            verifyToken: 'vt',
            accessToken: 'at',
            secret: 'sec',
            token: 'tok',
            apiKey: 'api-key',
            authToken: 'auth-token',
            serviceAccountKey: 'service-account-key',
            botFrameworkAppSecret: 'app-secret',
            tenantId: 'tenant-id',
          },
        ],
      },
    }

    const out = exportResourceCategoryMap({
      resources: withSecrets,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    const item = out.slackIntegration[0]

    for (const field of [
      'value',
      'signingSecret',
      'botToken',
      'userToken',
      'verifyToken',
      'accessToken',
      'secret',
      'token',
      'apiKey',
      'authToken',
      'serviceAccountKey',
      'botFrameworkAppSecret',
      'tenantId',
    ]) {
      expect(item).not.toHaveProperty(field)
    }

    expect(item).toMatchObject({ name: 'I' })
  })

  it('strips category-owned auth config under public sensitivity', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    expect(out.secret[0]).not.toHaveProperty('config')
    expect(out.mcpserverIntegration[0]).not.toHaveProperty('oAuthConnectionId')
    expect(out.mcpserverIntegration[0]).toMatchObject({
      name: 'MCP',
      skillsetId: 'sk-1',
    })
  })

  it('keeps credential fields under internal sensitivity', () => {
    const out = exportResourceCategoryMap({
      resources: grouped,
      sensitivity: 'internal',
      buckets: FULL_EXPORT_BUCKETS,
    })

    expect(out.bot[0]).toHaveProperty('botToken', 'should-not-leak')
    expect(out.secret[0]).toHaveProperty('value', 'super-secret')
    expect(out.secret[0]).toHaveProperty('config.clientSecret', 'nested-secret')
    expect(out.mcpserverIntegration[0]).toHaveProperty(
      'oAuthConnectionId',
      'oa-1'
    )
  })
})

describe('exportResourceDocument', () => {
  it('keys resources by "#type:::id", moves id into the key, strips sensitive', () => {
    const doc = exportResourceDocument({
      resources: grouped,
      sensitivity: 'public',
      buckets: TERRAFORM_EXPORT_BUCKETS,
    })

    expect(doc.resources['#bot:::bot-1']).toEqual({
      type: 'bot',
      data: { name: 'Bot', datasetId: 'ds-1' },
    })
    expect(doc.resources['#bot:::bot-1'].data).not.toHaveProperty('id')
    expect(doc.resources['#bot:::bot-1'].data).not.toHaveProperty('botToken')
    expect(doc.resources['#secret:::sec-1'].data).not.toHaveProperty('config')
    expect(doc.resources['#mcpserverIntegration:::mcp-1'].data).not.toHaveProperty(
      'oAuthConnectionId'
    )
  })

  it('suffixes integration token keys and types, includes compliance', () => {
    const doc = exportResourceDocument({
      resources: grouped,
      sensitivity: 'public',
      buckets: TERRAFORM_EXPORT_BUCKETS,
    })

    expect(doc.resources['#slackIntegration:::slk-1']).toMatchObject({
      type: 'slackIntegration',
      data: { name: 'Slack', botId: 'bot-1' },
    })
    expect(doc.resources['#policy:::pol-1']).toMatchObject({ type: 'policy' })
  })

  it('omits oauth under the terraform bucket set', () => {
    const doc = exportResourceDocument({
      resources: grouped,
      sensitivity: 'public',
      buckets: TERRAFORM_EXPORT_BUCKETS,
    })

    expect(doc.resources['#oAuthConnection:::oa-1']).toBeUndefined()
  })
})
