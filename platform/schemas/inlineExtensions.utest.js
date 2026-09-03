/**
 * @jest-environment node
 */

import extensionsSchema, {
  InlineAbilitySchema,
  InlineSkillsetsSchema,
} from '@/schemas/inlineExtensions'

import fs from 'fs'
import path from 'path'
import { zodToJsonSchema } from 'zod-to-json-schema'

const OLD_LINK_KEYS = ['secretId', 'fileId', 'botId', 'spaceId']

const validAbility = {
  name: 'lookup',
  description: 'Looks things up',
  instruction: 'Look it up',
}

describe('InlineAbilitySchema', () => {
  it('accepts name/description/instruction', () => {
    expect(InlineAbilitySchema.safeParse(validAbility).success).toBe(true)
  })

  it.each(['linkedSecretId', 'linkedSpaceId'])('accepts %s', (key) => {
    const result = InlineAbilitySchema.safeParse({
      ...validAbility,
      [key]: 'abc',
    })

    expect(result.success).toBe(true)
    expect(result.data[key]).toBe('abc')
  })

  it('accepts an open meta bag with arbitrary keys', () => {
    const meta = { agentId: 'x', nested: { a: [1, 2] }, flag: true }

    const result = InlineAbilitySchema.safeParse({ ...validAbility, meta })

    expect(result.success).toBe(true)
    expect(result.data.meta).toEqual(meta)
  })

  it.each(OLD_LINK_KEYS)('rejects the unknown %s key (strict)', (key) => {
    const result = InlineAbilitySchema.safeParse({
      ...validAbility,
      [key]: 'abc',
    })

    expect(result.success).toBe(false)
    expect(result.error.issues[0].code).toBe('unrecognized_keys')
    expect(result.error.issues[0].keys).toEqual([key])
  })

  it('keeps the standard message for an unrelated unknown key', () => {
    const result = InlineAbilitySchema.safeParse({
      ...validAbility,
      bogus: 'abc',
    })

    expect(result.success).toBe(false)
    expect(result.error.issues[0].code).toBe('unrecognized_keys')
    expect(result.error.issues[0].keys).toEqual(['bogus'])
    expect(result.error.issues[0].message).toBe(
      "Unrecognized key(s) in object: 'bogus'"
    )
  })

  it('rejects secretId with the standard unrecognized-key message', () => {
    const result = InlineAbilitySchema.safeParse({
      ...validAbility,
      secretId: 'abc',
    })

    expect(result.success).toBe(false)
    expect(result.error.issues[0].code).toBe('unrecognized_keys')
    expect(result.error.issues[0].message).toBe(
      "Unrecognized key(s) in object: 'secretId'"
    )
  })

  // @note deliberate - inline abilities can link a secret or a space only;
  // file/bot links are not part of the inline contract, so the
  // `linkedFileId`/`linkedBotId` keys are rejected like any unknown key
  it.each(['linkedFileId', 'linkedBotId'])(
    'rejects %s (not part of the inline contract)',
    (key) => {
      const result = InlineAbilitySchema.safeParse({
        ...validAbility,
        [key]: 'abc',
      })

      expect(result.success).toBe(false)
      expect(result.error.issues[0].code).toBe('unrecognized_keys')
    }
  )

  it('exposes exactly the inline contract keys', () => {
    expect(Object.keys(InlineAbilitySchema.shape).sort()).toEqual(
      [
        'name',
        'description',
        'instruction',
        'linkedSecretId',
        'linkedSpaceId',
        'meta',
      ].sort()
    )
  })
})

describe('extensionsSchema (joi bridge)', () => {
  const validExtensions = {
    skillsets: [
      {
        name: 'tools',
        description: null,
        abilities: [
          { ...validAbility, linkedSecretId: 'sec_1', meta: { k: 'v' } },
          { ...validAbility, name: 'search', linkedSpaceId: 'spc_1' },
        ],
      },
    ],
    datasets: [
      {
        name: 'facts',
        description: 'Some facts',
        records: [{ text: 'The sky is blue', meta: { source: 'test' } }],
      },
    ],
  }

  it('accepts a full valid skillsets + datasets payload', () => {
    const result = extensionsSchema.validate(validExtensions)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(validExtensions)
  })

  it('rejects an ability with an unrelated unknown key', () => {
    const result = extensionsSchema.validate({
      skillsets: [
        {
          abilities: [{ ...validAbility, bogus: 'x' }],
        },
      ],
    })

    expect(result.error).toBeDefined()
    expect(result.error.message).toMatch(/unrecognized/i)
    expect(result.error.message).toMatch(/bogus/)
  })
})

describe('OpenAPI parity', () => {
  // @note `scripts/build-api-spec.ts` runs `main()` on import, so the schema
  // is derived here exactly the way that script does it; the built artifact
  // (absent on a fresh clone) is checked additionally when present
  function abilityItemOf(extensions) {
    return extensions.properties.skillsets.items.properties.abilities.items
  }

  it('ability item properties equal the InlineAbilitySchema keys', () => {
    const derived = zodToJsonSchema(InlineSkillsetsSchema, {
      target: 'openApi3',
      $refStrategy: 'none',
    })

    const ability = abilityItemOf({
      properties: { skillsets: derived },
    })

    expect(Object.keys(ability.properties).sort()).toEqual(
      Object.keys(InlineAbilitySchema.shape).sort()
    )
    expect(ability.additionalProperties).toBe(false)
  })

  it('the built spec.json, when present, matches the InlineAbilitySchema keys', () => {
    const specPath = path.resolve(__dirname, '../public/api/v1/spec.json')

    if (!fs.existsSync(specPath)) {
      // the derived check above is the deterministic gate
      expect(fs.existsSync(specPath)).toBe(false)

      return
    }

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))

    const ability = abilityItemOf(spec.components.schemas.ExtensionsDefinition)

    expect(Object.keys(ability.properties).sort()).toEqual(
      Object.keys(InlineAbilitySchema.shape).sort()
    )
    expect(ability.additionalProperties).toBe(false)
  })
})
