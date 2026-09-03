/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  decryptString,
  encryptString,
  findKeyForMessage,
  makeKeychain,
  parseCloakedString,
} from '@chatbotkit-dev/cloak'
import type { Prisma as PrismaTypes } from '@chatbotkit-dev/db/client'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import debug from '@/lib/debug'

import { Prisma } from '@prisma/client/extension'

/**
 * Shape of the encrypted-fields map. Keys are Prisma model names; values are
 * tuples of that model's own scalar field names. Typed per-model against the
 * generated `Prisma.<Model>ScalarFieldEnum` unions so that renaming or
 * removing a field in `schema.prisma` breaks compilation here.
 */
type EncryptedFieldsMap = {
  readonly [M in PrismaTypes.ModelName]?: readonly (keyof PrismaTypes.TypeMap['model'][M]['payload']['scalars'])[]
}

/**
 * Map of model → fields that are encrypted at rest.
 *
 * This list MUST be kept in sync with `schema.prisma`. Every field listed
 * here must also carry a `/// @encrypted` annotation in the schema (and
 * vice versa). When adding a new encrypted field: update the schema, then
 * extend this map. Only recoverable credentials belong here - a column that
 * is looked up by equality (API keys, the OAuth server's own tokens) cannot
 * be encrypted with a random nonce and is not.
 */
export const ENCRYPTED_FIELDS = {
  // next-auth provider tokens, written by the adapter's linkAccount
  Account: ['access_token', 'refresh_token', 'id_token'],

  // identity-provider client secret configured for MCP auth
  OAuthConnection: ['clientSecret'],

  Secret: ['value'],
  SecretValue: ['value'],

  // integration credentials the platform presents to the provider
  TriggerIntegration: ['secret'],
  SlackIntegration: ['signingSecret', 'botToken', 'userToken'],
  DiscordIntegration: ['botToken'],
  MicrosoftteamsIntegration: ['botFrameworkAppSecret'],
  GooglechatIntegration: ['serviceAccountKey'],
  WhatsappIntegration: ['verifyToken', 'appSecret', 'accessToken'],
  MessengerIntegration: ['verifyToken', 'appSecret', 'accessToken'],
  InstagramIntegration: ['verifyToken', 'appSecret', 'accessToken'],
  TelegramIntegration: ['botToken'],
  TwilioIntegration: ['authToken'],
  AnamIntegration: ['apiKey'],
  RecallIntegration: ['apiKey', 'webhookSecret'],
  GithubIntegration: ['privateKey', 'webhookSecret'],
  NotionIntegration: ['token'],
  McpserverIntegration: ['accessToken'],
  SkillserverIntegration: ['accessToken'],

  Webhook: ['secret'],
} as const satisfies EncryptedFieldsMap

// @note flattened set of every field name that is encrypted on any model.
// Used when recursively walking read results so nested `include`-d relations
// are also decrypted transparently.
const ENCRYPTED_FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.values(ENCRYPTED_FIELDS).flat()
)

/**
 * Map of model → `Json` columns that are encrypted at rest as a whole
 * document. The stored form is a single cloak string in the column (a JSON
 * string scalar, which every provider accepts), so nothing inside can be
 * queried by path. Same annotation and key rules as `ENCRYPTED_FIELDS`.
 */
export const ENCRYPTED_JSON_FIELDS = {
  // free-form OAuth/basic-auth config; encrypting the whole document covers
  // any credential key the passthrough schema admits later
  Secret: ['config'],
} as const satisfies EncryptedFieldsMap

const ENCRYPTED_JSON_FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.values(ENCRYPTED_JSON_FIELDS).flat()
)

export function getEncryptedFields(model: string): {
  fields: readonly string[]
  jsonFields: readonly string[]
} {
  return {
    fields:
      (ENCRYPTED_FIELDS as Record<string, readonly string[] | undefined>)[
        model
      ] || [],
    jsonFields:
      (ENCRYPTED_JSON_FIELDS as Record<string, readonly string[] | undefined>)[
        model
      ] || [],
  }
}

/**
 * The keys the annotated columns are encrypted with:
 * `PRISMA_FIELD_ENCRYPTION_KEY`, a comma-separated keychain where the first
 * key encrypts and every key decrypts (rotation: prepend the new key, run
 * `pnpm script:backfill-database-encryption`, drop the old one). Field-level: it
 * encrypts individual credential columns, not the database. A separate
 * concern from the general-purpose `CLOAK_ENCRYPTION_KEY` used everywhere
 * else.
 *
 * Unset means no encryption: the extension is inert and the columns hold
 * what was written. Resolved on every call so a rotation in a long-lived
 * process takes effect without a restart.
 */
export function getFieldEncryptionKeys(): string[] {
  return (process.env.PRISMA_FIELD_ENCRYPTION_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

export function isFieldEncryptionEnabled(): boolean {
  return getFieldEncryptionKeys().length > 0
}

export function isCloaked(value: string): boolean {
  return !!parseCloakedString(value)
}

export async function encryptColumn(
  value: string,
  additionalData: string
): Promise<string> {
  return await encryptString(value, getFieldEncryptionKeys()[0], {
    additionalData,
  })
}

export async function decryptColumn(
  value: string,
  additionalData?: string
): Promise<string> {
  const keychain = await makeKeychain(getFieldEncryptionKeys())

  return await decryptString(value, findKeyForMessage(value, keychain), {
    additionalData,
  })
}

// @note operation lists are bound to `Prisma.PrismaAction` via `satisfies`,
// so any typo or name drift between Prisma versions fails compilation.

const WRITE_OPERATIONS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
] as const satisfies readonly PrismaTypes.PrismaAction[]

type WriteOperation = (typeof WRITE_OPERATIONS)[number]

const READ_OPERATIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createManyAndReturn',
  'update',
  'updateManyAndReturn',
  'upsert',
  'delete',
] as const satisfies readonly PrismaTypes.PrismaAction[]

type ReadOperation = (typeof READ_OPERATIONS)[number]

export function isWriteOperation(op: string): op is WriteOperation {
  return (WRITE_OPERATIONS as readonly string[]).includes(op)
}

export function isReadOperation(op: string): op is ReadOperation {
  return (READ_OPERATIONS as readonly string[]).includes(op)
}

/**
 * The additional authenticated data a column's ciphertexts are bound to.
 * Decrypting with any other value fails, so a ciphertext copied by raw SQL
 * from one column or model into another is rejected on read rather than
 * granting the target row a credential it never had. Row binding is
 * deliberately not part of it: `create` has no id before the write.
 */
export function additionalDataFor(model: string, field: string): string {
  return `${model}.${field}`
}

// @note every `<Model>.<field>` a given field name is encrypted under, so a
// value met while walking a nested `include` (where the owning model is not
// known) can still be matched to its column.
const CANDIDATE_MODELS_BY_FIELD: ReadonlyMap<string, readonly string[]> =
  new Map(
    [...ENCRYPTED_FIELD_NAMES, ...ENCRYPTED_JSON_FIELD_NAMES].map((field) => [
      field,
      [
        ...Object.entries(ENCRYPTED_FIELDS),
        ...Object.entries(ENCRYPTED_JSON_FIELDS),
      ]
        .filter(([, fields]) => (fields as readonly string[]).includes(field))
        .map(([model]) => model),
    ])
  )

async function encryptIfPlaintext(
  value: unknown,
  additionalData: string
): Promise<unknown> {
  if (typeof value !== 'string') {
    return value
  }

  // @note idempotent: if the value is already cloak-encrypted (e.g. passed
  // through a second time), leave it alone rather than double-encrypting.
  if (isCloaked(value)) {
    return value
  }

  return await encryptColumn(value, additionalData)
}

function isPlainJson(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    (typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype)
  )
}

/**
 * Encrypts a whole `Json` column value as its JSON serialisation. `null`,
 * `undefined` and the `Prisma.DbNull`/`JsonNull` sentinels pass through;
 * so does a string that is already a cloak message.
 */
async function encryptJsonIfPlaintext(
  value: unknown,
  additionalData: string
): Promise<unknown> {
  if (!isPlainJson(value)) {
    return value
  }

  if (typeof value === 'string' && isCloaked(value)) {
    return value
  }

  return await encryptColumn(JSON.stringify(value), additionalData)
}

/**
 * Decrypts a stored value for `field`, trying the owning model's column
 * binding first, then every other column that encrypts a field of the same
 * name, then the unbound legacy form (values encrypted before column binding
 * existed - `pnpm script:backfill-database-encryption` rewrites those).
 *
 * @throws when no binding and no key in the chain accepts the ciphertext -
 * the value was moved, tampered with, or encrypted under a key that is no
 * longer configured. Failing closed is the point; returning the ciphertext
 * would hand the caller an unusable credential that looks like one.
 */
async function decryptIfEncrypted(
  value: unknown,
  field: string,
  model?: string
): Promise<unknown> {
  if (typeof value !== 'string') {
    return value
  }

  // @note legacy/plaintext rows predating this extension are left untouched,
  // which allows for gradual migration (re-save to encrypt).
  if (!isCloaked(value)) {
    return value
  }

  const candidates = [
    ...(model ? [model] : []),
    ...(CANDIDATE_MODELS_BY_FIELD.get(field) || []).filter((m) => m !== model),
  ]

  for (const candidate of candidates) {
    try {
      return await decryptColumn(value, additionalDataFor(candidate, field))
    } catch {
      // try the next binding
    }
  }

  try {
    return await decryptColumn(value)
  } catch (error) {
    throw new Error(
      `Unable to decrypt ${model ? `${model}.` : ''}${field}: the ciphertext does not belong to this column or was encrypted under a key that is not configured (${(error as Error).message})`
    )
  }
}

/**
 * Decrypts a whole-document `Json` column back into the value that was
 * written. A plaintext row (object, array, or non-cloak string) is returned
 * as stored so pre-encryption data keeps reading.
 */
async function decryptJsonIfEncrypted(
  value: unknown,
  field: string,
  model?: string
): Promise<unknown> {
  if (typeof value !== 'string' || !isCloaked(value)) {
    return value
  }

  return JSON.parse((await decryptIfEncrypted(value, field, model)) as string)
}

/**
 * Encrypts the named fields on a data object, handling both plain assignment
 * (`{ field: 'v' }`) and Prisma's atomic `{ field: { set: 'v' } }` update
 * shape used in `update` / `upsert.update`.
 */
export async function encryptTopLevelFields(
  data: Record<string, unknown>,
  fields: readonly string[],
  model: string,
  jsonFields: readonly string[] = []
): Promise<Record<string, unknown>> {
  const next = { ...data }

  const encryptField = async (
    field: string,
    encryptValue: (value: unknown, additionalData: string) => Promise<unknown>
  ) => {
    if (!(field in next)) {
      return
    }

    const current = next[field]
    const additionalData = additionalDataFor(model, field)

    // @note a Json column has no atomic `{ set }` shape: an object there is
    // the document itself, so only scalar columns take that branch
    if (
      encryptValue === encryptIfPlaintext &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      'set' in (current as object)
    ) {
      next[field] = {
        ...(current as object),
        set: await encryptValue(
          (current as { set: unknown }).set,
          additionalData
        ),
      }
    } else {
      next[field] = await encryptValue(current, additionalData)
    }
  }

  for (const field of fields) {
    await encryptField(field, encryptIfPlaintext)
  }

  for (const field of jsonFields) {
    await encryptField(field, encryptJsonIfPlaintext)
  }

  return next
}

/**
 * Recursively walks a query result and decrypts any string property whose
 * name appears in ENCRYPTED_FIELDS and which passes the `isCloaked()`
 * format check. The fingerprint check (v1.aesgcm256...) is strict enough
 * that unrelated JSON strings will not be accidentally "decrypted".
 *
 * `model` is the queried model and applies to the top level of the result;
 * nested relation objects are decrypted against every column binding that
 * carries the field name (see `decryptIfEncrypted`).
 */
export async function decryptDeep(
  value: unknown,
  model?: string
): Promise<unknown> {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => decryptDeep(v, model)))
  }

  if (typeof value !== 'object') {
    return value
  }

  // @note Date and other non-plain objects should pass through untouched
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value
  }

  const obj = value as Record<string, unknown>
  const next: Record<string, unknown> = {}

  for (const [key, child] of Object.entries(obj)) {
    if (ENCRYPTED_FIELD_NAMES.has(key) && typeof child === 'string') {
      next[key] = await decryptIfEncrypted(child, key, model)
    } else if (
      ENCRYPTED_JSON_FIELD_NAMES.has(key) &&
      typeof child === 'string'
    ) {
      next[key] = await decryptJsonIfEncrypted(child, key, model)
    } else if (child && typeof child === 'object') {
      // @note a nested object is a relation; its model is not known here
      next[key] = await decryptDeep(child)
    } else {
      next[key] = child
    }
  }

  return next
}

export async function transformWriteArgs(
  args: any,
  operation: WriteOperation,
  fields: readonly string[],
  model: string,
  jsonFields: readonly string[] = []
): Promise<any> {
  const next = { ...args }

  switch (operation) {
    case 'create':
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      if (next.data && typeof next.data === 'object') {
        next.data = await encryptTopLevelFields(
          next.data,
          fields,
          model,
          jsonFields
        )
      }

      break

    case 'createMany':
    case 'createManyAndReturn':
      if (Array.isArray(next.data)) {
        next.data = await Promise.all(
          next.data.map((d: any) =>
            d && typeof d === 'object'
              ? encryptTopLevelFields(d, fields, model, jsonFields)
              : d
          )
        )
      } else if (next.data && typeof next.data === 'object') {
        next.data = await encryptTopLevelFields(
          next.data,
          fields,
          model,
          jsonFields
        )
      }

      break

    case 'upsert':
      if (next.create && typeof next.create === 'object') {
        next.create = await encryptTopLevelFields(
          next.create,
          fields,
          model,
          jsonFields
        )
      }

      if (next.update && typeof next.update === 'object') {
        next.update = await encryptTopLevelFields(
          next.update,
          fields,
          model,
          jsonFields
        )
      }

      break

    default:
      // @note exhaustiveness check - adding a new WriteOperation without a
      // case above will fail to compile here.
      assertUnreachable(operation)
  }

  return next
}

/**
 * Prisma extension that transparently encrypts fields on write and decrypts
 * them on read, with `@chatbotkit-dev/cloak` under `PRISMA_FIELD_ENCRYPTION_KEY`.
 *
 * Writes: top-level fields on the queried model's args (`args.data`, or
 * `args.create`/`args.update` for upsert) are encrypted; a `Json` column in
 * `ENCRYPTED_JSON_FIELDS` is serialised and encrypted as one document. Nested
 * writes to related models are NOT encrypted - perform those as separate
 * queries on the target model.
 *
 * Reads: the full result tree (including `include`-d relations) is walked
 * and any string field whose name matches an encrypted field is decrypted
 * when it passes the `isCloaked()` format check. Plaintext rows are
 * passed through untouched so legacy data keeps working; a ciphertext that
 * no configured key or column binding accepts throws.
 *
 * With `PRISMA_FIELD_ENCRYPTION_KEY` unset the extension is inert and the
 * columns hold what was written.
 * Every ciphertext is bound to its column with `<Model>.<field>` as AES-GCM
 * additional data (`additionalDataFor`), so this extension must be chained
 * BEFORE `withAudit` (audit rows then only ever see ciphertext) and AFTER
 * `withRetry` and `withCache`.
 */
export function withEncryption() {
  debug(`creating encryption extension`, {
    models: [
      ...new Set([
        ...Object.keys(ENCRYPTED_FIELDS),
        ...Object.keys(ENCRYPTED_JSON_FIELDS),
      ]),
    ],
  }).log('prisma.encryption')

  return Prisma.defineExtension({
    name: 'prisma-encryption',

    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // @note no PRISMA_FIELD_ENCRYPTION_KEY means no column encryption:
          // values are stored and returned as given. Rows encrypted while a
          // key was set come back as ciphertext until it is set again.
          if (!isFieldEncryptionEnabled()) {
            return query(args)
          }

          const { fields, jsonFields } = getEncryptedFields(model)

          if (fields.length === 0 && jsonFields.length === 0) {
            // @note a model with nothing of its own to encrypt can still
            // `include`/`select` a relation that has; only then is the
            // result walked, so plain reads of such models stay untouched
            if (
              isReadOperation(operation) &&
              args &&
              typeof args === 'object' &&
              ('include' in args || 'select' in args)
            ) {
              return decryptDeep(await query(args))
            }

            return query(args)
          }

          const nextArgs =
            isWriteOperation(operation) && args && typeof args === 'object'
              ? await transformWriteArgs(
                  args,
                  operation,
                  fields,
                  model,
                  jsonFields
                )
              : args

          const result = await query(nextArgs)

          if (!isReadOperation(operation)) {
            return result
          }

          if (operation === 'delete') {
            // @note the row is gone either way; a value that no longer
            // decrypts (moved, tampered, key dropped) must not make it
            // undeletable, so the returned copy is passed through as stored
            try {
              return await decryptDeep(result, model)
            } catch {
              return result
            }
          }

          return decryptDeep(result, model)
        },
      },
    },
  })
}

export default withEncryption
