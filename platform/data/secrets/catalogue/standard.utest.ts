import type {
  BasicSecret,
  BearerSecret,
  JwtSecret,
  OAuthSecret,
  PlainSecret,
  Secret,
  TemplateSecret,
} from '@/data/secrets/catalogue/standard.yaml'
import secrets from '@/data/secrets/catalogue/standard.yaml'

import { isEncrypted } from '@/lib/cloak'
import type { ZodSchemaFor } from '@/lib/zod.schema'
import z from '@/lib/zod.schema'

describe('secrets match schema', () => {
  const plainSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('plain'),

      config: z.object({}).strict().optional(),
    } satisfies ZodSchemaFor<PlainSecret>)
    .strict()

  const basicSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('basic'),

      config: z.object({}).strict().optional(),
    } satisfies ZodSchemaFor<BasicSecret>)
    .strict()

  const bearerSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('bearer'),

      config: z
        .object({
          scheme: z.string().optional(),
        })
        .strict()
        .optional(),
    } satisfies ZodSchemaFor<BearerSecret>)
    .strict()

  const oauthSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('oauth'),

      config: z.union([
        z
          .object({
            clientId: z.literal(''),
            clientSecret: z.literal(''),
            authorizationUrl: z.string(),
            tokenUrl: z.string(),
            revokeUrl: z.string().optional(),
            infoUrl: z.string().optional(),
            validateUrl: z.string().optional(),
            scope: z.string().optional(),
            grantType: z.literal('authorization_code').optional(),
          })
          .strict(),
        z
          .object({
            clientId: z.literal(''),
            clientSecret: z.literal(''),
            tokenUrl: z.string(),
            revokeUrl: z.string().optional(),
            infoUrl: z.string().optional(),
            validateUrl: z.string().optional(),
            scope: z.string().optional(),
            grantType: z.literal('client_credentials'),
          })
          .strict(),
        z
          .object({
            resourceUrl: z.string(),
            clientId: z.literal('').optional(),
            clientSecret: z.literal('').optional(),
          })
          .strict(),
      ]),
    } satisfies ZodSchemaFor<OAuthSecret>)
    .strict()

  const jwtSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('jwt'),

      config: z
        .object({
          algorithm: z.string().optional(),
          expiresInSeconds: z.number().optional(),
          claims: z.record(z.unknown()).optional(),
          schema: z.string().optional(),
        })
        .strict()
        .optional(),
    } satisfies ZodSchemaFor<JwtSecret>)
    .strict()

  const templateSecretSchema = z
    .object({
      icon: z.string().optional(),

      name: z.string(),
      description: z.string(),

      kind: z.enum(['shared', 'personal']).optional(),

      commentary: z.string().optional(),
      setup: z.string().optional(),

      tags: z.array(z.string()).optional(),

      // ---

      type: z.literal('template'),

      config: z
        .object({
          template: z.string(),
        })
        .strict(),
    } satisfies ZodSchemaFor<TemplateSecret>)
    .strict()

  const schema = z.discriminatedUnion('type', [
    plainSecretSchema,
    basicSecretSchema,
    bearerSecretSchema,
    jwtSecretSchema,
    oauthSecretSchema,
    templateSecretSchema,
  ])

  for (const [id, template] of Object.entries<Secret>(secrets)) {
    test(`secrets.yaml template "${id}" matches schema`, () => {
      expect(() => schema.parse(template)).not.toThrow()
    })
  }
})

describe('secret kind', () => {
  // @note the catalogue is static, so kind is stated on every template rather
  // than derived at runtime. This is the rule those values must follow: oauth
  // and the platform-hosted `template` type sign in a named account (personal),
  // everything else is a shared service credential.
  const PERSONAL_TYPES = new Set(['oauth', 'template'])

  const expectedKind = (type: string) =>
    PERSONAL_TYPES.has(type) ? 'personal' : 'shared'

  // @note deliberate deviations from the rule live here, keyed by template id
  // with a reason. Empty today - every template follows it. Add an entry only
  // for a service whose kind genuinely differs from its type, e.g. an org-wide
  // OAuth app that is really shared, or a per-user API token that is personal.
  const EXCEPTIONS: Record<string, string> = {}

  for (const [id, template] of Object.entries<Secret>(secrets)) {
    // @note the catalogue is static, so every template must state its kind
    // rather than leaning on a runtime default - this catches a new entry that
    // forgets one, or an unknown value
    test(`secret "${id}" declares a valid kind`, () => {
      expect(['shared', 'personal']).toContain(template.kind)
    })

    test(`secret "${id}" kind matches its type default`, () => {
      if (id in EXCEPTIONS) {
        return
      }

      expect(template.kind).toBe(expectedKind(template.type))
    })
  }
})

describe('secrets', () => {
  for (const id in secrets) {
    const { config } = secrets[id]

    if (!config) {
      continue
    }

    test(`secret "${id}" must be encrypted`, async () => {
      const clientId = 'clientId' in config ? config.clientId : undefined

      if (clientId) {
        expect(await isEncrypted(clientId)).toBe(true)
      }

      const clientSecret =
        'clientSecret' in config ? config.clientSecret : undefined

      if (clientSecret) {
        expect(await isEncrypted(clientSecret)).toBe(true)
      }
    })

    // @note platform hosted entries are no longer authored here. The platform
    // secret catalogue derives and contributes them, and asserts their shape
    // itself, so there is nothing left to check from this side.
  }
})
