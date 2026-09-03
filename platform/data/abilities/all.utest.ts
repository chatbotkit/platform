import { descriptionMaxLength } from '@/config/abilities'

import type { AbilityTemplate } from '@/data/abilities/all'
import abilities from '@/data/abilities/all'
import secrets from '@/data/secrets/all'

import { getInstructionType } from '@/lib/instruction.type'
import type { ZodSchemaFor } from '@/lib/zod.schema'
import z from '@/lib/zod.schema'

import fs from 'fs'
import path from 'path'

// @todo make sure that we automatically test this list against the pipedream
// capabilities to ensure that none of them have oauth
const platformSecretReferenceExclusions: string[] = [
  '@bearer',
  '@brave/search',
  '@sendgrid',
  '@easypost',
  '@godaddy',
  '@coda',
  '@codeqr',
  '@vapi',
  '@elevenlabs',
  '@firecrawl',
  '@ably',
  '@activecampaign',
  '@telegram',
  '@taxjar',
  '@cloudinary',
  '@openweathermap',
  '@mapbox',
  '@vanta',
  '@linkupso',
  '@peopledatalabs',
  '@context7',
  '@bigcommerce',
  '@buffer',
  '@twitter',
  '@facebook[page]',
  '@facebook[ads]',
  '@stripe',
  '@chargebee',
  '@cal',
  '@lemonsqueezy',
  '@gumroad',
  '@monday',
  '@nubela/proxycurl',
  '@okta',
  '@clearbit',
  '@usefind',
  '@hyperproof',
  '@slack',
  '@beehiiv',
  '@slack[search]',
  '@discord[bot]',
  '@coinapi',
  '@serpapi',
  '@hunter',
  '@instantly',
  '@gohighlevel',
  '@resend',
  '@betterstack[clickhouse]',
  '@postgrest/rest',
  '@serper',
  '@mailgun',
  '@replicate',
  '@uplead',
  '@snowflake',
  '@revenuecat',
  '@barcodelookup',
  '@productboard',
  '@supabase',
  '@bamboohr',
  '@geocodio',
  '@twilio',
  '@brandfetch',
  '@financialmodelingprep',
  '@clickhouse',
  '@clockify',
  '@listennotes',
  '@weatherbit',
  '@manychat',
  '@tavily',
  '@abstractapi',
  '@diffbot',
  '@devto',
  '@ably',
  '@alphavantage',
  '@newsapi',
  '@sprites',
  '@amplitude',
  '@github[app]',
  '@sentry',
  '@giphy',
  '@glimpse',
  '@matillion',
  '@planetscale',
  '@zapier/ai-actions',
  '@pexels',
  '@accuweather',
  '@alpaca',
  '@alpaca[paper]',
  '@openai[ads]',
]

// @todo find a way to ensure that we don't have regressions in this execlusion
// list similarly do it for the secret reference exclusions
const mcpSecretReferenceExclusions: string[] = [
  '@betterstack[key]',
  '@platform/pagerduty',
  '@github[key]',
  '@isometric[key]',
  '@context7',
  '@firecrawl',
  '@linkupso[key]',
  '@instantly',
  '@google-maps[key]',
  '@google-bigquery[key]',
  '@hunter',
  '@posthog[key]',
  '@tavily',
  '@platform/dropbox',
  '@buffer',
]

function isAutomaticallyExcludedPlatformSecretReference(
  secretReference: string
) {
  return secretReference.endsWith('[key]') || secretReference.endsWith('[mcp]')
}

function isBlueprintSecretReference(secretReference: string) {
  return secretReference.startsWith('#')
}

function isPlatformSecretReference(secretReference: string) {
  return secretReference.startsWith('@platform/')
}

function isExcludedPlatformSecretReference(secretReference: string) {
  return (
    isBlueprintSecretReference(secretReference) ||
    platformSecretReferenceExclusions.includes(secretReference) ||
    isAutomaticallyExcludedPlatformSecretReference(secretReference)
  )
}

describe('schema', () => {
  const schema = z
    .object({
      name: z.string().min(1),
      description: z.string().min(1).max(descriptionMaxLength),
      instruction: z.string().min(1),

      provider: z.string(),
      icon: z.string(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      secret: z.string().optional(),
      file: z.string().optional(),
      space: z.string().optional(),
      bot: z.string().optional(),
    } satisfies ZodSchemaFor<AbilityTemplate>)
    .strict()

  for (const [name, ability] of Object.entries<AbilityTemplate>(abilities)) {
    test(`ability "${name}" matches schema`, () => {
      expect(() => schema.parse(ability)).not.toThrow()
    })
  }
})

describe('abilities', () => {
  it('should have all ability names in lower-case', () => {
    // @note the reason we do that is because getTemplate from template.js does
    // a simple dictionary lookup and we want to make sure that the names are
    // normalized to lower-case

    for (const name of Object.keys(abilities)) {
      expect(name).toEqual(name.toLowerCase())
    }
  })

  describe('instruction type', () => {
    const abilityEntries = Object.entries<AbilityTemplate>(abilities)

    it.each(abilityEntries)(
      '%s should have structured/simple instruction type',
      (slug, { instruction }) => {
        const type = getInstructionType(instruction)

        expect(type).toMatch(/^(structured|simple)$/)
      }
    )
  })

  // @note disabled because the test is incorrect
  // it('packs must have correct ability names', () => {
  //   const packs = Object.fromEntries(
  //     Object.entries<AbilityTemplate>(abilities).filter(([key]) =>
  //       key.startsWith('pack/')
  //     )
  //   )

  //   for (const [, { instruction }] of Object.entries(packs)) {
  //     const actions = parseText(instruction).actions
  //     const lastAction = actions.pop()

  //     expect(lastAction).toBeDefined()

  //     const config = parseYaml(lastAction!.text)

  //     expect(config.backstory).toBeDefined()
  //     expect(config.task).toBeDefined()
  //     expect(config.abilities).toBeDefined()

  //     for (const ability of config.abilities) {
  //       const template = unpackTemplateInstruction(ability)

  //       expect(template).toBeDefined()
  //     }
  //   }
  // })

  // @note disabled because the test is incorrect
  // it('jmespath options must be valid', () => {
  //   expect(() => jmespath('foo.bar', {})).not.toThrow()
  //   expect(() => jmespath('^', {})).toThrow()

  //   for (const ability in abilities) {
  //     const template = unpackTemplateInstruction(ability)

  //     expect(template).toBeDefined()

  //     if (template && 'jmespath' in template && template.jmespath) {
  //       expect(() => jmespath(template.jmespath, {})).not.toThrow()
  //     }
  //   }
  // })

  // @note disabled because the test is incorrect
  // it('jsonpath options must be valid', () => {
  //   expect(() => jsonpath('foo.bar', {})).not.toThrow()
  //   expect(() => jsonpath('@', {})).toThrow()

  //   for (const ability in abilities) {
  //     const template = unpackTemplateInstruction(ability)

  //     expect(template).toBeDefined()

  //     if (template && 'jsonpath' in template && template.jsonpath) {
  //       expect(() => jsonpath(template.jsonpath, {})).not.toThrow()
  //     }
  //   }
  // })

  describe('should have valid secret references', () => {
    for (const [name, ability] of Object.entries<AbilityTemplate>(abilities)) {
      if (
        ability.secret &&
        !isBlueprintSecretReference(ability.secret) &&
        !isPlatformSecretReference(ability.secret)
      ) {
        const secretName = ability.secret?.slice(1) // remove '@' prefix

        it(`ability "${name}" have valid secret references ${secretName}`, () => {
          expect(secrets[secretName]).toBeDefined()
        })
      }
    }
  })

  describe('should use mcp secrets for mcp abilities', () => {
    it('should keep the mcp secret exclusion list in sync', () => {
      const invalidMcpSecretExclusions = mcpSecretReferenceExclusions.filter(
        (secretReference) => {
          const secret = secrets[secretReference.slice(1)]

          return (
            (!secret && !isPlatformSecretReference(secretReference)) ||
            secretReference.endsWith('[mcp]') ||
            !Object.entries<AbilityTemplate>(abilities).some(
              ([name, ability]) =>
                name.startsWith('mcp/') && ability.secret === secretReference
            )
          )
        }
      )

      expect(invalidMcpSecretExclusions).toEqual([])
    })

    it('should require every mcp ability secret to end with [mcp]', () => {
      const invalidMcpSecretReferences = Object.entries<AbilityTemplate>(
        abilities
      )
        .filter(([name, ability]) => name.startsWith('mcp/') && ability.secret)
        .filter(
          ([, ability]) =>
            !mcpSecretReferenceExclusions.includes(ability.secret!) &&
            !ability.secret!.endsWith('[mcp]')
        )
        .map(([name, ability]) => ({
          name,
          secret: ability.secret,
        }))

      expect(invalidMcpSecretReferences).toEqual([])
    })
  })

  describe('should link abilities to platform secrets', () => {
    it('should keep the exclusion list in sync', () => {
      const invalidExclusions = platformSecretReferenceExclusions.filter(
        (secretReference) =>
          isAutomaticallyExcludedPlatformSecretReference(secretReference) ||
          !secrets[secretReference.slice(1)] ||
          !Object.values<AbilityTemplate>(abilities).some(
            (ability) => ability.secret === secretReference
          )
      )

      expect(invalidExclusions).toEqual([])
    })

    it('should only use platform secret references for non-excluded abilities', () => {
      const invalidSecretReferences = Object.entries<AbilityTemplate>(abilities)
        .filter(([, ability]) => ability.secret)
        .filter(
          ([, ability]) => !isExcludedPlatformSecretReference(ability.secret!)
        )
        .filter(([, ability]) => !ability.secret!.startsWith('@platform/'))
        .map(([name, ability]) => ({
          name,
          secret: ability.secret,
        }))

      expect(invalidSecretReferences).toEqual([])
    })
  })

  describe('should have all catalogue files registered', () => {
    it('should register all .js, .ts, and .yaml files from catalogue folder', () => {
      const cataloguePath = path.join(__dirname, 'catalogue')

      // Read all files in the catalogue directory
      const catalogueFiles = fs.readdirSync(cataloguePath).filter((file) => {
        // Include only .js, .ts, and .yaml files
        const validExtensions = ['.js', '.ts', '.yaml']
        const hasValidExtension = validExtensions.some((ext) =>
          file.endsWith(ext)
        )

        // Exclude unit test files and openapi specs
        const isUnitTest = file.includes('.utest.')
        const isOpenApiSpec = file.includes('.openapi.')

        return hasValidExtension && !isUnitTest && !isOpenApiSpec
      })

      // Read the all.ts file to check for imports
      const allTsPath = path.join(__dirname, 'all.ts')
      const allTsContent = fs.readFileSync(allTsPath, 'utf-8')

      // Check each file is imported in all.ts
      const missingFiles: string[] = []

      for (const file of catalogueFiles) {
        const fileName = file.replace(/\.(js|ts|yaml)$/, '')

        // Check if this file is imported in all.ts
        // @note we escape dots in filenames for regex matching
        const escapedFileName = fileName.replace(/\./g, '\\.')
        const importPattern = new RegExp(
          `from ['"]@/data/abilities/catalogue/${escapedFileName}`,
          'm'
        )

        if (!importPattern.test(allTsContent)) {
          missingFiles.push(file)
        }
      }

      if (missingFiles.length > 0) {
        throw new Error(
          `The following files are not imported in all.ts:\n${missingFiles.join(
            '\n'
          )}`
        )
      }

      expect(missingFiles).toEqual([])
    })
  })
})
