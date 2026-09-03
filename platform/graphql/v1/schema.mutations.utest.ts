/**
 * @jest-environment node
 */

import { graphql } from 'graphql'

const update = jest.fn(async () => ({ id: 'ability_1' }))
const botUpdate = jest.fn(async () => ({ id: 'bot_1' }))
const integrationUpdate = {
  whatsapp: jest.fn(async () => ({ id: 'whatsapp_1' })),
  messenger: jest.fn(async () => ({ id: 'messenger_1' })),
  instagram: jest.fn(async () => ({ id: 'instagram_1' })),
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(async () => ({
    skillset: { ability: { update } },
    bot: { update: botUpdate },
    integration: {
      whatsapp: { update: integrationUpdate.whatsapp },
      messenger: { update: integrationUpdate.messenger },
      instagram: { update: integrationUpdate.instagram },
    },
  })),
}))

import { schema } from '@/graphql/v1/schema'

const context = { session: { user: { id: 'user_1' } }, caller: null }

describe('updateSkillsetAbility', () => {
  it('passes an explicit null link through so the link is cleared, while other nulls are still omitted', async () => {
    const result = await graphql({
      schema,
      source: `
        mutation ($input: SkillsetAbilityUpdateRequest!) {
          updateSkillsetAbility(skillsetId: "skillset_1", abilityId: "ability_1", input: $input) {
            id
          }
        }
      `,
      variableValues: {
        input: {
          name: null,
          description: 'kept',
          linkedSecretId: null,
          linkedBotId: 'bot_2',
        },
      },
      contextValue: context,
    })

    expect(result.errors).toBeUndefined()
    expect(update).toHaveBeenCalledWith('skillset_1', 'ability_1', {
      description: 'kept',
      linkedSecretId: null,
      linkedBotId: 'bot_2',
    })
  })

  it.each([
    'alias',
    'linkedSecretId',
    'linkedFileId',
    'linkedBotId',
    'linkedSpaceId',
    'blueprintId',
  ])('preserves null for %s', async (key) => {
    const result = await graphql({
      schema,
      source: `
        mutation ($input: SkillsetAbilityUpdateRequest!) {
          updateSkillsetAbility(skillsetId: "skillset_1", abilityId: "ability_1", input: $input) {
            id
          }
        }
      `,
      variableValues: { input: { [key]: null } },
      contextValue: context,
    })

    expect(result.errors).toBeUndefined()
    expect(update).toHaveBeenCalledWith('skillset_1', 'ability_1', {
      [key]: null,
    })
  })
})

describe.each([
  ['updateWhatsAppIntegration', 'whatsapp', 'WhatsAppIntegrationUpdateRequest'],
  ['updateMessengerIntegration', 'messenger', 'MessengerIntegrationUpdateRequest'],
  ['updateInstagramIntegration', 'instagram', 'InstagramIntegrationUpdateRequest'],
] as const)('%s', (mutation, integration, inputType) => {
  it('passes explicit null credentials through so they are cleared, while other nulls are still omitted', async () => {
    const result = await graphql({
      schema,
      source: `
        mutation ($input: ${inputType}!) {
          ${mutation}(${integration}IntegrationId: "${integration}_1", input: $input) {
            id
          }
        }
      `,
      variableValues: {
        input: {
          name: null,
          description: 'kept',
          accessToken: null,
          appSecret: null,
        },
      },
      contextValue: context,
    })

    expect(result.errors).toBeUndefined()
    expect(integrationUpdate[integration]).toHaveBeenCalledWith(
      `${integration}_1`,
      {
        description: 'kept',
        accessToken: null,
        appSecret: null,
      }
    )
  })

  it.each(['alias', 'accessToken', 'appSecret'])(
    'preserves null for %s',
    async (key) => {
      const result = await graphql({
        schema,
        source: `
          mutation ($input: ${inputType}!) {
            ${mutation}(${integration}IntegrationId: "${integration}_1", input: $input) {
              id
            }
          }
        `,
        variableValues: { input: { [key]: null } },
        contextValue: context,
      })

      expect(result.errors).toBeUndefined()
      expect(integrationUpdate[integration]).toHaveBeenCalledWith(
        `${integration}_1`,
        { [key]: null }
      )
    }
  )
})
