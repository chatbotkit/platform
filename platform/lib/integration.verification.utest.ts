/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  DiscordIntegrationModel,
  EmailIntegrationModel,
  GooglechatIntegrationModel,
  InstagramIntegrationModel,
  MessengerIntegrationModel,
  MicrosoftteamsIntegrationModel,
  SlackIntegrationModel,
  TelegramIntegrationModel,
  TwilioIntegrationModel,
  WhatsappIntegrationModel,
  WidgetIntegrationModel,
} from '@/prisma/zod'

import {
  INTEGRATION_CREDENTIALS,
  INTEGRATION_INSTALL_INTENT_PARAM,
  getIntegrationCredentialSelection,
  getIntegrationVerification,
} from './integration.verification'

// @note the generated zod models mirror the Prisma columns 1:1, so they are the
// source of truth for "is this a real field" - the same technique
// blueprint.fields.utest.ts uses to keep the credential list honest
type ModelLike = { shape: Record<string, unknown> }

const columns = (model: ModelLike): Set<string> =>
  new Set(Object.keys(model.shape))

const MODELS_BY_TYPE: Record<string, ModelLike> = {
  slack: SlackIntegrationModel,
  discord: DiscordIntegrationModel,
  telegram: TelegramIntegrationModel,
  twilio: TwilioIntegrationModel,
  microsoftteams: MicrosoftteamsIntegrationModel,
  whatsapp: WhatsappIntegrationModel,
  messenger: MessengerIntegrationModel,
  instagram: InstagramIntegrationModel,
  googlechat: GooglechatIntegrationModel,
  widget: WidgetIntegrationModel,
  email: EmailIntegrationModel,
}

describe('INTEGRATION_CREDENTIALS', () => {
  it('names a real prisma column for every credential', () => {
    // @note a typo here would make `required.every(...)` vacuously true and
    // silently report every cloned integration as configured
    for (const [type, fields] of Object.entries(INTEGRATION_CREDENTIALS)) {
      const model = MODELS_BY_TYPE[type]

      expect(model).toBeDefined()

      for (const field of fields) {
        expect([type, field, columns(model).has(field)]).toEqual([
          type,
          field,
          true,
        ])
      }
    }
  })

  it('covers every channel the overview can render', () => {
    expect(Object.keys(INTEGRATION_CREDENTIALS).sort()).toEqual(
      Object.keys(MODELS_BY_TYPE).sort()
    )
  })
})

describe('the graph exposes a verification for every integration', () => {
  // @note the credential table and the graph field have to move together: an
  // integration registered here but not wired into the schema is invisible to
  // every client, and one wired into the schema but not registered here is
  // reported configured no matter what. Neither failure shows up at runtime,
  // so the coupling is asserted against the schema source instead.
  const schema = readFileSync(
    join(__dirname, '..', 'graphql', 'v1', 'schema.ts'),
    'utf8'
  )

  it('wires every registered integration into the schema', () => {
    for (const type of Object.keys(INTEGRATION_CREDENTIALS)) {
      expect([
        type,
        schema.includes(`integrationVerificationField(t, '${type}')`),
      ]).toEqual([type, true])
    }
  })

  it('registers every integration the schema wires up', () => {
    const wired = [
      ...schema.matchAll(/integrationVerificationField\(t, '(\w+)'\)/g),
    ].map(([, type]) => type)

    expect(wired.length).toBeGreaterThan(0)

    for (const type of wired) {
      expect([type, type in INTEGRATION_CREDENTIALS]).toEqual([type, true])
    }
  })
})

describe('getIntegrationCredentialSelection', () => {
  it('selects exactly the credentials a type requires, plus the id', () => {
    // @note the id is what the install action links to
    expect(getIntegrationCredentialSelection('slack')).toEqual({
      id: true,
      signingSecret: true,
      botToken: true,
    })
  })

  it('selects only the id for a credential free type', () => {
    expect(getIntegrationCredentialSelection('widget')).toEqual({ id: true })
  })
})

describe('getIntegrationVerification', () => {
  it('offers no action once an integration is configured', () => {
    expect(
      getIntegrationVerification('slack', {
        id: 'si1',
        signingSecret: 'ss',
        botToken: 'bt',
      })
    ).toEqual({ status: 'configured', action: null })
  })

  it('hands back the install route when an integration cannot carry traffic', () => {
    // @note the graph carries the route so no client has to rebuild it from
    // the type and the id - the same way a secret carries its authenticate URL
    expect(getIntegrationVerification('slack', { id: 'si1' })).toEqual({
      status: 'unconfigured',
      action: { type: 'install', url: '/integrations/slack/si1?install=1' },
    })
  })

  it('flags the install route so the page it lands on opens its instructions', () => {
    // @note the flag is what tells the integration page the user has already
    // pressed "Install" and should not have to press it again on arrival - see
    // `useInstallIntent`
    const { action } = getIntegrationVerification('telegram', { id: 'ti1' })

    expect(
      new URL(action!.url, 'https://example.com').searchParams.get(
        INTEGRATION_INSTALL_INTENT_PARAM
      )
    ).toBe('1')
  })

  it('reports a credential free integration as configured', () => {
    expect(getIntegrationVerification('widget', { id: 'wi1' })).toEqual({
      status: 'configured',
      action: null,
    })
  })
})

// @note the credential predicate is module private, so it is exercised through
// the verification - which is the only thing any caller ever sees
describe('which credentials a verification demands', () => {
  const status = (type: string, row: Record<string, unknown> | null) =>
    getIntegrationVerification(type, row).status

  it('needs every credential a type requires, not just one', () => {
    expect(
      status('slack', { id: 'si1', signingSecret: 'ss', botToken: 'bt' })
    ).toBe('configured')

    // @note a cloned slack integration keeps its name and settings but loses
    // both tokens - it looks fine and answers nobody
    expect(status('slack', { id: 'si1', signingSecret: 'ss' })).toBe(
      'unconfigured'
    )
    expect(status('slack', { id: 'si1', botToken: 'bt' })).toBe('unconfigured')
    expect(status('slack', { id: 'si1' })).toBe('unconfigured')
  })

  it('treats an empty credential as absent', () => {
    expect(
      status('slack', { id: 'si1', signingSecret: '', botToken: 'bt' })
    ).toBe('unconfigured')

    expect(
      status('slack', { id: 'si1', signingSecret: null, botToken: 'bt' })
    ).toBe('unconfigured')
  })

  it('reports a credential free type as configured by existing', () => {
    expect(status('widget', { id: 'wi1' })).toBe('configured')
    expect(status('email', { id: 'ei1' })).toBe('configured')
  })

  it('does not nag about a type it does not model', () => {
    expect(status('carrier-pigeon', { id: 'cp1' })).toBe('configured')
  })

  it('survives a missing row', () => {
    expect(status('slack', null)).toBe('unconfigured')
    expect(status('widget', null)).toBe('configured')
  })
})
