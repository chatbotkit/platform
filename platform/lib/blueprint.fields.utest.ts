/**
 * @jest-environment node
 */
import {
  AnamIntegrationModel,
  DiscordIntegrationModel,
  GithubIntegrationModel,
  GooglechatIntegrationModel,
  InstagramIntegrationModel,
  McpserverIntegrationModel,
  MessengerIntegrationModel,
  MicrosoftteamsIntegrationModel,
  NotionIntegrationModel,
  RecallIntegrationModel,
  SecretModel,
  SlackIntegrationModel,
  TelegramIntegrationModel,
  TriggerIntegrationModel,
  TwilioIntegrationModel,
  WhatsappIntegrationModel,
} from '@/prisma/zod'

import {
  UNMANAGED_FIELDS,
  UNMANAGED_FIELDS_BY_CATEGORY,
  getReferenceFieldType,
  isReferenceFieldFor,
  isUnmanagedBlueprintField,
} from './blueprint.fields'
import { categoryRegistry } from './blueprint.import'

// @note importing `categoryRegistry` pulls in blueprint.import.ts, which loads
// the prisma client + cuid at module scope. Neither is invoked here (the
// registry is a pure const), so trivial mocks are enough.
jest.mock('@/prisma/client', () => ({ __esModule: true, default: {} }))
jest.mock('@/lib/cuid', () => ({ cuid: jest.fn(() => 'cuid') }))

// @note the generated zod models mirror the Prisma columns 1:1, so they are the
// source of truth for "is this a real field". Prisma 7 removed the runtime DMMF
// (see prisma/models.ts), so the generated models are the validation surface.
type ModelLike = { shape: Record<string, unknown> }

const columns = (model: ModelLike): Set<string> =>
  new Set(Object.keys(model.shape))

const MODELS_BY_NAME = {
  Secret: SecretModel,
  SlackIntegration: SlackIntegrationModel,
  GithubIntegration: GithubIntegrationModel,
  DiscordIntegration: DiscordIntegrationModel,
  TelegramIntegration: TelegramIntegrationModel,
  WhatsappIntegration: WhatsappIntegrationModel,
  MessengerIntegration: MessengerIntegrationModel,
  InstagramIntegration: InstagramIntegrationModel,
  McpserverIntegration: McpserverIntegrationModel,
  TriggerIntegration: TriggerIntegrationModel,
  NotionIntegration: NotionIntegrationModel,
  AnamIntegration: AnamIntegrationModel,
  RecallIntegration: RecallIntegrationModel,
  TwilioIntegration: TwilioIntegrationModel,
  GooglechatIntegration: GooglechatIntegrationModel,
  MicrosoftteamsIntegration: MicrosoftteamsIntegrationModel,
} as unknown as Record<string, ModelLike>

// @note each global credential field mapped to EVERY model it must be stripped
// from (mirrors the per-field comments in blueprint.fields.ts). Asserting against
// each model - not a union - catches a per-model rename where the old column name
// survives on a sibling model (a union existence check would stay green while the
// renamed model's credential silently leaks).
const FIELD_MODELS: Record<string, string[]> = {
  value: ['Secret'],
  signingSecret: ['SlackIntegration'],
  botToken: ['SlackIntegration', 'DiscordIntegration', 'TelegramIntegration'],
  userToken: ['SlackIntegration'],
  verifyToken: [
    'WhatsappIntegration',
    'MessengerIntegration',
    'InstagramIntegration',
  ],
  appSecret: [
    'WhatsappIntegration',
    'MessengerIntegration',
    'InstagramIntegration',
  ],
  accessToken: [
    'WhatsappIntegration',
    'MessengerIntegration',
    'InstagramIntegration',
    'McpserverIntegration',
  ],
  secret: ['TriggerIntegration'],
  token: ['NotionIntegration'],
  apiKey: ['AnamIntegration', 'RecallIntegration'],
  authToken: ['TwilioIntegration'],
  serviceAccountKey: ['GooglechatIntegration'],
  botFrameworkAppSecret: ['MicrosoftteamsIntegration'],
  tenantId: ['MicrosoftteamsIntegration'],
  privateKey: ['GithubIntegration'],
  webhookSecret: ['GithubIntegration'],
}

// category name (as used by UNMANAGED_FIELDS_BY_CATEGORY) -> its Prisma model.
// Kept explicit so a newly-added category without a mapping fails loudly below.
const CATEGORY_MODELS = {
  secret: SecretModel,
  mcpserverIntegration: McpserverIntegrationModel,
} as unknown as Record<string, ModelLike>

describe('UNMANAGED_FIELDS', () => {
  it('maps exactly the declared credential fields (no missing, no stale)', () => {
    const unmapped = [...UNMANAGED_FIELDS].filter(
      (field) => !FIELD_MODELS[field]
    )
    const stale = Object.keys(FIELD_MODELS).filter(
      (field) => !UNMANAGED_FIELDS.has(field)
    )

    expect({ unmapped, stale }).toEqual({ unmapped: [], stale: [] })
  })

  it('every credential field is a real column on each model it must be stripped from', () => {
    const missing: string[] = []

    for (const [field, modelNames] of Object.entries(FIELD_MODELS)) {
      for (const name of modelNames) {
        const model = MODELS_BY_NAME[name]

        if (!model || !columns(model).has(field)) {
          missing.push(`${field}@${name}`)
        }
      }
    }

    expect(missing).toEqual([])
  })
})

describe('UNMANAGED_FIELDS_BY_CATEGORY', () => {
  it('every category is a real runtime category (a categoryRegistry key)', () => {
    // @note this is the category string the export/import path actually passes to
    // isUnmanagedBlueprintField; tying to categoryRegistry catches a rename of the
    // runtime category that would silently stop the by-category strip.
    const unknownCategories = Object.keys(UNMANAGED_FIELDS_BY_CATEGORY).filter(
      (category) => !(category in categoryRegistry)
    )

    expect(unknownCategories).toEqual([])
  })

  it('every category maps to a known model in this test', () => {
    const unmapped = Object.keys(UNMANAGED_FIELDS_BY_CATEGORY).filter(
      (category) => !CATEGORY_MODELS[category]
    )

    expect(unmapped).toEqual([])
  })

  it('every category-field pair is a real column on that model', () => {
    for (const [category, fields] of Object.entries(
      UNMANAGED_FIELDS_BY_CATEGORY
    )) {
      const model = CATEGORY_MODELS[category]

      if (!model) {
        continue
      }

      const cols = columns(model)
      const missing = [...fields].filter((field) => !cols.has(field))

      expect({ category, missing }).toEqual({ category, missing: [] })
    }
  })
})

describe('isUnmanagedBlueprintField', () => {
  it('treats a global credential field as unmanaged regardless of category', () => {
    expect(isUnmanagedBlueprintField('botToken')).toBe(true)
    expect(isUnmanagedBlueprintField('botToken', 'slackIntegration')).toBe(true)
  })

  it('treats the secret config blob as unmanaged only within its category', () => {
    expect(isUnmanagedBlueprintField('config', 'secret')).toBe(true)
    expect(isUnmanagedBlueprintField('config', 'bot')).toBe(false)
    expect(isUnmanagedBlueprintField('config')).toBe(false)
  })

  it('treats the mcpserver oAuthConnection reference as unmanaged only within its category', () => {
    expect(
      isUnmanagedBlueprintField('oAuthConnectionId', 'mcpserverIntegration')
    ).toBe(true)
    expect(isUnmanagedBlueprintField('oAuthConnectionId', 'bot')).toBe(false)
    expect(isUnmanagedBlueprintField('oAuthConnectionId')).toBe(false)
  })

  it('treats an ordinary template field as managed', () => {
    expect(isUnmanagedBlueprintField('name')).toBe(false)
    expect(isUnmanagedBlueprintField('description', 'bot')).toBe(false)
  })
})

describe('getReferenceFieldType', () => {
  it('maps a plain reference field to its resource type', () => {
    expect(getReferenceFieldType('botId')).toBe('bot')
    expect(getReferenceFieldType('skillsetId')).toBe('skillset')
    expect(getReferenceFieldType('oAuthConnectionId')).toBe('oAuthConnection')
  })

  it('maps an ability linked reference field to its resource type', () => {
    expect(getReferenceFieldType('linkedSecretId')).toBe('secret')
    expect(getReferenceFieldType('linkedFileId')).toBe('file')
    expect(getReferenceFieldType('linkedBotId')).toBe('bot')
    expect(getReferenceFieldType('linkedSpaceId')).toBe('space')
  })

  it('does not treat a lowercase linked prefix as a prefix', () => {
    expect(getReferenceFieldType('linkedinId')).toBe('linkedin')
  })

  it('returns null for a non-reference field', () => {
    expect(getReferenceFieldType('name')).toBeNull()
    expect(getReferenceFieldType('linked')).toBeNull()
  })
})

describe('isReferenceFieldFor', () => {
  it('matches both plain and linked reference fields', () => {
    expect(isReferenceFieldFor('secretId', 'secret')).toBe(true)
    expect(isReferenceFieldFor('linkedSecretId', 'secret')).toBe(true)
    expect(isReferenceFieldFor('linkedSecretId', 'bot')).toBe(false)
    expect(isReferenceFieldFor('secret', 'secret')).toBe(false)
  })
})
