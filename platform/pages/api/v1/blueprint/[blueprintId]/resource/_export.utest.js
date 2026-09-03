/**
 * @jest-environment node
 */
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'
import { blueprintToTerraform } from '@/lib/blueprint.terraform'

import handler from './export'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/blueprint.resources', () => ({
  getBlueprintAndCloneableResources: jest.fn(),
}))

jest.mock('@/lib/blueprint.terraform', () => ({
  blueprintToTerraform: jest.fn(),
}))

describe('/api/v1/blueprint/[blueprintId]/resource/export', () => {
  const mockSession = {
    user: {
      id: 'user-1',
    },
  }

  function makeRequest(overrides = {}) {
    return {
      query: { blueprintId: 'bp-1' },
      headers: new Headers({ accept: 'application/json' }),
      ...overrides,
    }
  }

  const mockBlueprintAndResources = {
    blueprint: {
      id: 'bp-1',
      userId: 'user-1',
      alias: 'my-blueprint',
      name: 'Test Blueprint',
      description: 'A test blueprint',
      visibility: 'private',
      config: null,
      meta: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    },
    resources: {
      basic: {
        bot: [
          {
            id: 'bot-1',
            name: 'Test Bot',
            description: 'A bot',
            backstory: 'You are helpful',
            model: 'gpt-4',
            datasetId: 'ds-1',
            skillsetId: 'sk-1',
            meta: { tag: 'test' },
          },
        ],
        dataset: [
          {
            id: 'ds-1',
            name: 'Test Dataset',
            description: 'A dataset',
            meta: null,
          },
        ],
        skillset: [],
        ability: [],
        secret: [],
        file: [],
        portals: [],
      },
      object: {
        space: [],
      },
      integration: {
        extract: [],
        notion: [],
        sitemap: [],
        support: [],
        email: [],
        trigger: [],
        widget: [],
        slack: [],
        discord: [],
        microsoftteams: [],
        googlechat: [],
        telegram: [],
        whatsapp: [],
        messenger: [],
        instagram: [],
        twilio: [],
        avatar: [],
        anam: [],
        recall: [],
        mcpserver: [],
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when blueprint does not exist', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(null)

    const response = await handler(makeRequest(), mockSession)

    expect(response.status).toBe(404)
  })

  it('returns 403 when blueprint belongs to another user', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      blueprint: {
        ...mockBlueprintAndResources.blueprint,
        userId: 'other-user',
      },
    })

    const response = await handler(makeRequest(), mockSession)

    expect(response.status).toBe(403)
  })

  it('returns JSON export by default', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(
      mockBlueprintAndResources
    )

    const response = await handler(makeRequest(), mockSession)

    expect(response.status).toBe(200)

    const contentType = response.headers.get('content-type')

    expect(contentType).toContain('application/json')

    const body = await response.json()

    expect(body.id).toBe('bp-1')
    expect(body.name).toBeUndefined()
    expect(body.description).toBeUndefined()
    expect(body.visibility).toBeUndefined()
    expect(body.config).toBeUndefined()
    expect(body.meta).toBeUndefined()
    expect(body.resources.bot).toHaveLength(1)
    expect(body.resources.bot[0].id).toBe('bot-1')
    expect(body.resources.bot[0].name).toBe('Test Bot')
    expect(body.resources.bot[0].datasetId).toBe('ds-1')
    expect(body.resources.bot[0].skillsetId).toBe('sk-1')
    expect(body.resources.dataset).toHaveLength(1)
  })

  it('returns JSON export when accept header is application/json', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(
      mockBlueprintAndResources
    )

    const response = await handler(
      makeRequest({
        headers: new Headers({ accept: 'application/json' }),
      }),
      mockSession
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.id).toBe('bp-1')
    expect(body.resources).toBeDefined()
  })

  it('returns Terraform HCL when accept header is application/terraform+hcl', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(
      mockBlueprintAndResources
    )

    blueprintToTerraform.mockReturnValue('terraform { }')

    const response = await handler(
      makeRequest({
        headers: new Headers({ accept: 'application/terraform+hcl' }),
      }),
      mockSession
    )

    expect(response.status).toBe(200)

    const contentType = response.headers.get('content-type')

    expect(contentType).toContain('application/terraform+hcl')

    const disposition = response.headers.get('content-disposition')

    expect(disposition).toContain('my-blueprint.tf')

    const body = await response.text()

    expect(body).toBe('terraform { }')

    expect(blueprintToTerraform).toHaveBeenCalledWith({
      resources: expect.objectContaining({
        '#bot:::bot-1': {
          type: 'bot',
          data: expect.objectContaining({ name: 'Test Bot' }),
        },
        '#dataset:::ds-1': {
          type: 'dataset',
          data: expect.objectContaining({ name: 'Test Dataset' }),
        },
      }),
    })
  })

  it('uses blueprint id in filename when alias is not set', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      blueprint: {
        ...mockBlueprintAndResources.blueprint,
        alias: null,
      },
    })

    blueprintToTerraform.mockReturnValue('')

    const response = await handler(
      makeRequest({
        headers: new Headers({ accept: 'application/terraform+hcl' }),
      }),
      mockSession
    )

    const disposition = response.headers.get('content-disposition')

    expect(disposition).toContain('bp-1.tf')
  })

  it('includes integration resources with Integration suffix in JSON export', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      resources: {
        ...mockBlueprintAndResources.resources,
        integration: {
          ...mockBlueprintAndResources.resources.integration,
          trigger: [
            {
              id: 'trig-1',
              name: 'Daily Trigger',
              description: 'Runs daily',
              botId: 'bot-1',
              schedule: '0 0 * * *',
              meta: null,
            },
          ],
        },
      },
    })

    const response = await handler(makeRequest(), mockSession)
    const body = await response.json()

    expect(body.resources.triggerIntegration).toHaveLength(1)
    expect(body.resources.triggerIntegration[0].name).toBe('Daily Trigger')
    expect(body.resources.triggerIntegration[0].botId).toBe('bot-1')
  })

  it('maps integration resources with Integration suffix for Terraform', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      resources: {
        ...mockBlueprintAndResources.resources,
        integration: {
          ...mockBlueprintAndResources.resources.integration,
          trigger: [
            {
              id: 'trig-1',
              name: 'Daily Trigger',
              description: 'Runs daily',
              botId: 'bot-1',
              schedule: '0 0 * * *',
              meta: null,
            },
          ],
        },
      },
    })

    blueprintToTerraform.mockReturnValue('')

    await handler(
      makeRequest({
        headers: new Headers({ accept: 'application/terraform+hcl' }),
      }),
      mockSession
    )

    expect(blueprintToTerraform).toHaveBeenCalledWith({
      resources: expect.objectContaining({
        '#triggerIntegration:::trig-1': {
          type: 'triggerIntegration',
          data: expect.objectContaining({
            name: 'Daily Trigger',
            botId: 'bot-1',
          }),
        },
      }),
    })
  })

  it('includes full resource data in JSON export', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue(
      mockBlueprintAndResources
    )

    const response = await handler(makeRequest(), mockSession)
    const body = await response.json()

    const bot = body.resources.bot[0]

    expect(bot.backstory).toBe('You are helpful')
    expect(bot.model).toBe('gpt-4')
    expect(bot.datasetId).toBe('ds-1')
    expect(bot.skillsetId).toBe('sk-1')
  })

  it('strips sensitive fields from JSON export', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      resources: {
        ...mockBlueprintAndResources.resources,
        basic: {
          ...mockBlueprintAndResources.resources.basic,
          secret: [
            {
              id: 'sec-1',
              name: 'API Key',
              description: 'An API key',
              value: 'super-secret-value',
              config: {
                clientId: 'client-id',
                clientSecret: 'nested-client-secret',
                password: 'nested-password',
              },
              meta: null,
            },
          ],
        },
        integration: {
          ...mockBlueprintAndResources.resources.integration,
          slack: [
            {
              id: 'slack-1',
              name: 'Slack',
              description: 'Slack integration',
              botId: 'bot-1',
              signingSecret: 'secret-signing',
              botToken: 'xoxb-secret',
              userToken: 'xoxp-secret',
              meta: null,
            },
          ],
          discord: [
            {
              id: 'discord-1',
              name: 'Discord',
              description: 'Discord integration',
              botId: 'bot-1',
              botToken: 'discord-secret-token',
              meta: null,
            },
          ],
          microsoftteams: [
            {
              id: 'teams-1',
              name: 'Teams',
              description: 'Teams integration',
              botId: 'bot-1',
              botFrameworkAppId: 'app-id',
              botFrameworkAppSecret: 'teams-secret',
              tenantId: 'tenant-secret',
              meta: null,
            },
          ],
          googlechat: [
            {
              id: 'google-1',
              name: 'Google Chat',
              description: 'Google Chat integration',
              botId: 'bot-1',
              serviceAccountKey: '{"private_key":"SECRET"}',
              projectNumber: '123',
              meta: null,
            },
          ],
          twilio: [
            {
              id: 'twilio-1',
              name: 'Twilio',
              description: 'Twilio integration',
              botId: 'bot-1',
              accountSid: 'account-sid',
              authToken: 'twilio-secret',
              meta: null,
            },
          ],
          anam: [
            {
              id: 'anam-1',
              name: 'Anam',
              description: 'Anam integration',
              botId: 'bot-1',
              apiKey: 'anam-secret',
              meta: null,
            },
          ],
          recall: [
            {
              id: 'recall-1',
              name: 'Recall',
              description: 'Recall integration',
              botId: 'bot-1',
              apiKey: 'recall-secret',
              meta: null,
            },
          ],
          mcpserver: [
            {
              id: 'mcp-1',
              name: 'MCP',
              description: 'MCP server integration',
              skillsetId: 'sk-1',
              oAuthConnectionId: 'oauth-secret',
              meta: null,
            },
          ],
        },
      },
    })

    const response = await handler(makeRequest(), mockSession)
    const body = await response.json()

    const secret = body.resources.secret[0]

    expect(secret.name).toBe('API Key')
    expect(secret.value).toBeUndefined()
    expect(secret.config).toBeUndefined()

    const slack = body.resources.slackIntegration[0]

    expect(slack.name).toBe('Slack')
    expect(slack.botId).toBe('bot-1')
    expect(slack.signingSecret).toBeUndefined()
    expect(slack.botToken).toBeUndefined()
    expect(slack.userToken).toBeUndefined()

    const discord = body.resources.discordIntegration[0]

    expect(discord.name).toBe('Discord')
    expect(discord.botToken).toBeUndefined()

    const teams = body.resources.microsoftteamsIntegration[0]

    expect(teams.name).toBe('Teams')
    expect(teams.botFrameworkAppId).toBe('app-id')
    expect(teams.botFrameworkAppSecret).toBeUndefined()
    expect(teams.tenantId).toBeUndefined()

    const googlechat = body.resources.googlechatIntegration[0]

    expect(googlechat.name).toBe('Google Chat')
    expect(googlechat.projectNumber).toBe('123')
    expect(googlechat.serviceAccountKey).toBeUndefined()

    const twilio = body.resources.twilioIntegration[0]

    expect(twilio.name).toBe('Twilio')
    expect(twilio.accountSid).toBe('account-sid')
    expect(twilio.authToken).toBeUndefined()

    const anam = body.resources.anamIntegration[0]

    expect(anam.name).toBe('Anam')
    expect(anam.apiKey).toBeUndefined()

    const recall = body.resources.recallIntegration[0]

    expect(recall.name).toBe('Recall')
    expect(recall.apiKey).toBeUndefined()

    const mcpserver = body.resources.mcpserverIntegration[0]

    expect(mcpserver.name).toBe('MCP')
    expect(mcpserver.skillsetId).toBe('sk-1')
    expect(mcpserver.oAuthConnectionId).toBeUndefined()
  })

  it('strips sensitive fields from Terraform export', async () => {
    getBlueprintAndCloneableResources.mockResolvedValue({
      ...mockBlueprintAndResources,
      resources: {
        ...mockBlueprintAndResources.resources,
        integration: {
          ...mockBlueprintAndResources.resources.integration,
          mcpserver: [
            {
              id: 'mcp-1',
              name: 'MCP',
              description: 'MCP server integration',
              skillsetId: 'sk-1',
              oAuthConnectionId: 'oauth-secret',
              meta: null,
            },
          ],
          telegram: [
            {
              id: 'tg-1',
              name: 'Telegram',
              description: 'Telegram bot',
              botId: 'bot-1',
              botToken: 'telegram-secret-token',
              meta: null,
            },
          ],
          googlechat: [
            {
              id: 'google-1',
              name: 'Google Chat',
              description: 'Google Chat integration',
              botId: 'bot-1',
              serviceAccountKey: '{"private_key":"SECRET"}',
              meta: null,
            },
          ],
          microsoftteams: [
            {
              id: 'teams-1',
              name: 'Teams',
              description: 'Teams integration',
              botId: 'bot-1',
              botFrameworkAppSecret: 'teams-secret',
              tenantId: 'tenant-secret',
              meta: null,
            },
          ],
        },
      },
    })

    blueprintToTerraform.mockReturnValue('')

    await handler(
      makeRequest({
        headers: new Headers({ accept: 'application/terraform+hcl' }),
      }),
      mockSession
    )

    const callArg = blueprintToTerraform.mock.calls[0][0]
    const telegramData = callArg.resources['#telegramIntegration:::tg-1'].data
    const mcpserverData =
      callArg.resources['#mcpserverIntegration:::mcp-1'].data
    const googleData =
      callArg.resources['#googlechatIntegration:::google-1'].data
    const teamsData =
      callArg.resources['#microsoftteamsIntegration:::teams-1'].data

    expect(telegramData.name).toBe('Telegram')
    expect(telegramData.botId).toBe('bot-1')
    expect(telegramData.botToken).toBeUndefined()
    expect(mcpserverData.skillsetId).toBe('sk-1')
    expect(mcpserverData.oAuthConnectionId).toBeUndefined()
    expect(googleData.serviceAccountKey).toBeUndefined()
    expect(teamsData.botFrameworkAppSecret).toBeUndefined()
    expect(teamsData.tenantId).toBeUndefined()
  })
})
