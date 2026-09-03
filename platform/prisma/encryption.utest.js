/**
 * @jest-environment node
 */

/* eslint-disable custom-eslint-rules/require-typed-sql, custom-eslint-rules/require-safe-prisma-delete -- the real-row half of this suite looks at rows as stored, on a raw client, and tears down its own throwaway user */
import {
  encryptString,
  generateKey,
  getMessageKeyFingerprint,
  parseKey,
} from '@chatbotkit-dev/cloak'
import { createInstance as createRawInstance } from '@chatbotkit-dev/db'

import prisma from '@/prisma/client'
import {
  ENCRYPTED_FIELDS,
  ENCRYPTED_JSON_FIELDS,
  additionalDataFor,
  decryptColumn,
  decryptDeep,
  encryptColumn,
  encryptTopLevelFields,
  getFieldEncryptionKeys,
  isCloaked,
  isFieldEncryptionEnabled,
  isReadOperation,
  isWriteOperation,
  transformWriteArgs,
  withEncryption,
} from '@/prisma/encryption'

import { PrismaDbNull, PrismaJsonNull } from '@/prisma/nulls'

import { CREDENTIAL_POLICY } from '@/lib/credential.policy'

import { PrismaAdapter } from '@next-auth/prisma-adapter'

import fs from 'node:fs'
import path from 'node:path'

// @note the suite is about encryption, so it needs a database key; the
// example environment ships one, and a run without one gets a throwaway
// key rather than a wall of failures
if (!isFieldEncryptionEnabled()) {
  process.env.PRISMA_FIELD_ENCRYPTION_KEY = generateKey()
}

const CLOAK_PREFIX = /^v1\.aesgcm256\.[0-9a-f]{8}\.[A-Za-z0-9_-]{16}\./

/** Runs `fn` with PRISMA_FIELD_ENCRYPTION_KEY temporarily set to `value`. */
async function withKey(value, fn) {
  const previous = process.env.PRISMA_FIELD_ENCRYPTION_KEY

  process.env.PRISMA_FIELD_ENCRYPTION_KEY = value

  try {
    return await fn()
  } finally {
    process.env.PRISMA_FIELD_ENCRYPTION_KEY = previous
  }
}

/** Encrypts the way the extension does: database key, column binding. */
const cipher = (value, aad) => encryptColumn(value, aad)

/** The unbound legacy form: database key, no column binding. */
const unboundCipher = (value) =>
  encryptString(value, process.env.PRISMA_FIELD_ENCRYPTION_KEY.split(',')[0])

/** Asserts a stored value is a bound ciphertext of `expected`. */
async function expectCipher(stored, expected, aad) {
  expect(stored).toMatch(CLOAK_PREFIX)

  // @note a one-letter plaintext is bound to occur inside base64 by chance
  if (expected.length > 4) {
    expect(stored).not.toContain(expected)
  }

  expect(await decryptColumn(stored, aad)).toBe(expected)
}

// @note the spec schema is the source of truth - the installed db module's
// schema is derived from it, so the annotations are identical either way
const SCHEMA = path.join(
  path.dirname(require.resolve('@chatbotkit-dev/db-spec/derive')),
  '..',
  'prisma',
  'schema.prisma'
)

/**
 * Collects `model -> [field]` for every field carrying a `/// @encrypted`
 * doc comment.
 */
function readAnnotatedFields(schema) {
  const out = {}

  let model

  for (const line of schema.split('\n')) {
    const open = line.match(/^model\s+(\w+)\s+\{/)

    if (open) {
      model = open[1]

      continue
    }

    if (/^\}/.test(line)) {
      model = undefined

      continue
    }

    if (model && /\/\/\/.*@encrypted\b/.test(line)) {
      const field = line.trim().split(/\s+/)[0]

      out[model] = [...(out[model] || []), field]
    }
  }

  return out
}

describe('ENCRYPTED_FIELDS', () => {
  it('lists Secret.value as encrypted', () => {
    expect(ENCRYPTED_FIELDS.Secret).toEqual(['value'])
  })

  it('lists SecretValue.value as encrypted', () => {
    expect(ENCRYPTED_FIELDS.SecretValue).toEqual(['value'])
  })

  it('lists Secret.config as a whole-document encrypted Json column', () => {
    expect(ENCRYPTED_JSON_FIELDS.Secret).toEqual(['config'])
  })

  it('never lists a column in both maps', () => {
    for (const [model, jsonFields] of Object.entries(ENCRYPTED_JSON_FIELDS)) {
      for (const field of jsonFields) {
        expect((ENCRYPTED_FIELDS[model] || []).includes(field)).toBe(false)
      }
    }
  })

  it('matches every /// @encrypted annotation in the schema exactly', () => {
    const annotated = readAnnotatedFields(fs.readFileSync(SCHEMA, 'utf8'))

    const normalize = (map) =>
      Object.fromEntries(
        Object.entries(map)
          .map(([model, fields]) => [model, [...fields].sort()])
          .sort(([a], [b]) => a.localeCompare(b))
      )

    const declared = { ...ENCRYPTED_FIELDS }

    for (const [model, fields] of Object.entries(ENCRYPTED_JSON_FIELDS)) {
      declared[model] = [...(declared[model] || []), ...fields]
    }

    // @note a field annotated but missing here is written in plaintext while
    // the schema claims otherwise; a field here but not annotated is the
    // reverse lie - both fail
    expect(normalize(declared)).toEqual(normalize(annotated))
  })

  it('covers every recoverable credential column of the output policy', () => {
    // @note the policy table classifies how a credential leaves the
    // platform; everything it lists must be encrypted, except the documented
    // exclusions
    const excluded = [
      'DiscordIntegration.publicKey', // a public key
      'VerificationToken.token', // next-auth stores hashToken(token) already
      // looked up by equality (`/// @digest` in the schema): an encrypted
      // column cannot be queried, so these are not encrypted here
      'Token.token',
      'OAuthApplicationToken.accessToken',
      'OAuthApplicationToken.refreshToken',
      'OAuthApplication.clientSecret',
    ]

    for (const [model, columns] of Object.entries(CREDENTIAL_POLICY)) {
      for (const column of Object.keys(columns)) {
        const name = `${model}.${column}`

        if (excluded.includes(name)) {
          continue
        }

        expect({
          [name]:
            (ENCRYPTED_FIELDS[model] || []).includes(column) ||
            (ENCRYPTED_JSON_FIELDS[model] || []).includes(column),
        }).toEqual({ [name]: true })
      }
    }
  })
})

describe('isWriteOperation', () => {
  const writeOps = [
    'create',
    'createMany',
    'createManyAndReturn',
    'update',
    'updateMany',
    'updateManyAndReturn',
    'upsert',
  ]

  it.each(writeOps)('returns true for %s', (op) => {
    expect(isWriteOperation(op)).toBe(true)
  })

  it.each(['findMany', 'findUnique', 'delete', 'count', 'not-an-op'])(
    'returns false for %s',
    (op) => {
      expect(isWriteOperation(op)).toBe(false)
    }
  )
})

describe('isReadOperation', () => {
  const readOps = [
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
  ]

  it.each(readOps)('returns true for %s', (op) => {
    expect(isReadOperation(op)).toBe(true)
  })

  it.each(['createMany', 'updateMany', 'count', 'not-an-op'])(
    'returns false for %s',
    (op) => {
      expect(isReadOperation(op)).toBe(false)
    }
  )
})

describe('additionalDataFor', () => {
  it('is <Model>.<field>', () => {
    expect(additionalDataFor('Secret', 'value')).toBe('Secret.value')
  })
})

describe('encryptTopLevelFields', () => {
  it('encrypts matching string fields, bound to the model and column', async () => {
    const result = await encryptTopLevelFields(
      { value: 'secret', other: 'keep' },
      ['value'],
      'Secret'
    )

    await expectCipher(result.value, 'secret', 'Secret.value')
    expect(result.other).toBe('keep')
  })

  it('handles atomic { set } update shape', async () => {
    const result = await encryptTopLevelFields(
      { value: { set: 'secret' } },
      ['value'],
      'Secret'
    )

    await expectCipher(result.value.set, 'secret', 'Secret.value')
  })

  it('does not double-encrypt already-encrypted values', async () => {
    const already = await cipher('already', 'Secret.value')

    const result = await encryptTopLevelFields(
      { value: already },
      ['value'],
      'Secret'
    )

    expect(result.value).toBe(already)
  })

  it('leaves non-string values untouched', async () => {
    const result = await encryptTopLevelFields(
      { value: null, other: 42 },
      ['value'],
      'Secret'
    )

    expect(result.value).toBeNull()
    expect(result.other).toBe(42)
  })

  it('skips fields not present on the input', async () => {
    const result = await encryptTopLevelFields(
      { other: 'hello' },
      ['value'],
      'Secret'
    )

    expect('value' in result).toBe(false)
    expect(result.other).toBe('hello')
  })

  it('does not mutate the input object', async () => {
    const input = { value: 'secret' }

    await encryptTopLevelFields(input, ['value'], 'Secret')

    expect(input.value).toBe('secret')
  })

  it('binds each field to its own model and column', async () => {
    const [a, b] = await Promise.all([
      encryptTopLevelFields({ value: 'x' }, ['value'], 'Secret'),
      encryptTopLevelFields({ value: 'x' }, ['value'], 'SecretValue'),
    ])

    await expectCipher(a.value, 'x', 'Secret.value')
    await expectCipher(b.value, 'x', 'SecretValue.value')

    // @note the binding is what differs, not just the nonce
    await expect(decryptColumn(a.value, 'SecretValue.value')).rejects.toThrow()
  })
})

describe('encryptTopLevelFields (Json columns)', () => {
  const config = { clientId: 'id', clientSecret: 'hush', scope: 'a b' }

  it('encrypts the whole document as one cloak string bound to the column', async () => {
    const result = await encryptTopLevelFields(
      { config, name: 'keep' },
      [],
      'Secret',
      ['config']
    )

    expect(result.name).toBe('keep')
    expect(typeof result.config).toBe('string')
    expect(result.config).not.toContain('hush')
    expect(result.config).not.toContain('clientId')

    await expectCipher(result.config, JSON.stringify(config), 'Secret.config')
  })

  it('encrypts scalar and Json columns of the same row', async () => {
    const result = await encryptTopLevelFields(
      { value: 'v', config },
      ['value'],
      'Secret',
      ['config']
    )

    await expectCipher(result.value, 'v', 'Secret.value')
    await expectCipher(result.config, JSON.stringify(config), 'Secret.config')
  })

  it('encrypts arrays and bare scalars, which a Json column can also hold', async () => {
    const result = await encryptTopLevelFields(
      { config: ['a', 'b'] },
      [],
      'Secret',
      ['config']
    )

    await expectCipher(result.config, '["a","b"]', 'Secret.config')

    const scalar = await encryptTopLevelFields(
      { config: 'bare' },
      [],
      'Secret',
      ['config']
    )

    await expectCipher(scalar.config, '"bare"', 'Secret.config')
  })

  it('treats a `set` key inside the document as data, not as the atomic shape', async () => {
    const result = await encryptTopLevelFields(
      { config: { set: 'literal' } },
      [],
      'Secret',
      ['config']
    )

    await expectCipher(result.config, '{"set":"literal"}', 'Secret.config')
  })

  it('leaves null, undefined and the Prisma null sentinels untouched', async () => {
    const result = await encryptTopLevelFields(
      { config: null, meta: undefined },
      [],
      'Secret',
      ['config', 'meta']
    )

    expect(result.config).toBeNull()
    expect(result.meta).toBeUndefined()

    const dbNull = await encryptTopLevelFields(
      { config: PrismaDbNull },
      [],
      'Secret',
      ['config']
    )

    expect(dbNull.config).toBe(PrismaDbNull)

    const jsonNull = await encryptTopLevelFields(
      { config: PrismaJsonNull },
      [],
      'Secret',
      ['config']
    )

    expect(jsonNull.config).toBe(PrismaJsonNull)
  })

  it('does not double-encrypt an already-encrypted document', async () => {
    const already = await cipher(JSON.stringify(config), 'Secret.config')

    const result = await encryptTopLevelFields(
      { config: already },
      [],
      'Secret',
      ['config']
    )

    expect(result.config).toBe(already)
  })

  it('skips Json fields not present on the input', async () => {
    const result = await encryptTopLevelFields({ name: 'n' }, [], 'Secret', [
      'config',
    ])

    expect(result).toEqual({ name: 'n' })
  })
})

describe('decryptDeep (Json columns)', () => {
  const config = { clientId: 'id', clientSecret: 'hush' }

  it('decrypts and parses a whole-document column against the queried model', async () => {
    const result = await decryptDeep(
      { id: '1', config: await cipher(JSON.stringify(config), 'Secret.config') },
      'Secret'
    )

    expect(result).toEqual({ id: '1', config })
  })

  it('round-trips arrays and bare scalars', async () => {
    expect(
      await decryptDeep(
        { config: await cipher('["a","b"]', 'Secret.config') },
        'Secret'
      )
    ).toEqual({ config: ['a', 'b'] })

    expect(
      await decryptDeep(
        { config: await cipher('"bare"', 'Secret.config') },
        'Secret'
      )
    ).toEqual({ config: 'bare' })
  })

  it('rejects a document ciphertext moved from another column', async () => {
    await expect(
      decryptDeep(
        { id: '1', config: await cipher('{"a":1}', 'Secret.value') },
        'Secret'
      )
    ).rejects.toThrow(/Unable to decrypt Secret.config/)
  })

  it('leaves a plaintext document untouched (pre-encryption rows)', async () => {
    const result = await decryptDeep({ id: '1', config }, 'Secret')

    expect(result).toEqual({ id: '1', config })
  })

  it('leaves a plaintext bare string untouched', async () => {
    const result = await decryptDeep({ id: '1', config: 'bare' }, 'Secret')

    expect(result).toEqual({ id: '1', config: 'bare' })
  })

  it('leaves a same-named Json column on a model outside the map untouched', async () => {
    // @note Portal.config is a plain object here; the walker recurses into it
    // as it would any nested object and finds nothing to decrypt
    const result = await decryptDeep(
      { id: '1', config: { apps: { x: {} } } },
      'Portal'
    )

    expect(result).toEqual({ id: '1', config: { apps: { x: {} } } })
  })

  it('decrypts the document of an include-d relation', async () => {
    const result = await decryptDeep(
      {
        id: 'u',
        secrets: [
          {
            id: '1',
            value: await cipher('v', 'Secret.value'),
            config: await cipher(JSON.stringify(config), 'Secret.config'),
          },
        ],
      },
      'User'
    )

    expect(result).toEqual({
      id: 'u',
      secrets: [{ id: '1', value: 'v', config }],
    })
  })
})

describe('transformWriteArgs (Json columns)', () => {
  const config = { clientSecret: 'hush' }

  it('encrypts the document on create, update and both upsert branches', async () => {
    const create = await transformWriteArgs(
      { data: { config } },
      'create',
      [],
      'Secret',
      ['config']
    )

    await expectCipher(create.data.config, JSON.stringify(config), 'Secret.config')

    const update = await transformWriteArgs(
      { where: { id: '1' }, data: { config } },
      'update',
      [],
      'Secret',
      ['config']
    )

    await expectCipher(update.data.config, JSON.stringify(config), 'Secret.config')

    const upsert = await transformWriteArgs(
      { where: { id: '1' }, create: { config }, update: { config } },
      'upsert',
      [],
      'Secret',
      ['config']
    )

    await expectCipher(upsert.create.config, JSON.stringify(config), 'Secret.config')
    await expectCipher(upsert.update.config, JSON.stringify(config), 'Secret.config')
  })

  it('leaves the document alone when the model lists no Json fields', async () => {
    const result = await transformWriteArgs(
      { data: { config } },
      'create',
      [],
      'Portal'
    )

    expect(result.data.config).toBe(config)
  })
})

describe('decryptDeep', () => {
  it('decrypts top-level encrypted fields against the queried model', async () => {
    const result = await decryptDeep(
      { id: '1', value: await cipher('secret', 'Secret.value') },
      'Secret'
    )

    expect(result).toEqual({ id: '1', value: 'secret' })
  })

  it('rejects a ciphertext moved from another column', async () => {
    await expect(
      decryptDeep(
        { id: '1', serviceAccountKey: await cipher('moved', 'Secret.value') },
        'GooglechatIntegration'
      )
    ).rejects.toThrow(
      /Unable to decrypt GooglechatIntegration.serviceAccountKey/
    )
  })

  it('accepts a same-name column from another model (documented limitation)', async () => {
    // @note SecretValue.value and Secret.value share a field name, so the
    // nested-relation fallback accepts either binding - see
    // decryptIfEncrypted; the two hold the same class of data
    const result = await decryptDeep(
      { id: '1', value: await cipher('moved', 'SecretValue.value') },
      'Secret'
    )

    expect(result.value).toBe('moved')
  })

  it('rejects a ciphertext no key or binding accepts', async () => {
    await expect(
      decryptDeep(
        { id: '1', value: await cipher('x', 'Other.value') },
        'Secret'
      )
    ).rejects.toThrow(/Unable to decrypt Secret.value/)
  })

  it('accepts the legacy unbound form so pre-binding rows still read', async () => {
    const result = await decryptDeep(
      { id: '1', value: await unboundCipher('legacy') },
      'Secret'
    )

    expect(result.value).toBe('legacy')
  })

  it('leaves plaintext value fields untouched', async () => {
    const result = await decryptDeep({ id: '1', value: 'plain' }, 'Secret')

    expect(result).toEqual({ id: '1', value: 'plain' })
  })

  it('only decrypts fields whose names appear in ENCRYPTED_FIELDS', async () => {
    const name = await cipher('not-encrypted-field', 'Secret.value')

    const result = await decryptDeep({ name })

    expect(result.name).toBe(name)
  })

  it('recurses into arrays of objects', async () => {
    const result = await decryptDeep(
      [
        { value: await cipher('a', 'Secret.value') },
        { value: await cipher('b', 'Secret.value') },
      ],
      'Secret'
    )

    expect(result).toEqual([{ value: 'a' }, { value: 'b' }])
  })

  it('recurses into nested relation objects (include case)', async () => {
    const result = await decryptDeep(
      {
        id: '1',
        value: await cipher('top', 'Secret.value'),
        secretValues: [
          { id: '2', value: await cipher('child', 'SecretValue.value') },
        ],
      },
      'Secret'
    )

    expect(result).toEqual({
      id: '1',
      value: 'top',
      secretValues: [{ id: '2', value: 'child' }],
    })
  })

  it('passes Date objects through untouched', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const result = await decryptDeep(
      { createdAt: now, value: await cipher('x', 'Secret.value') },
      'Secret'
    )

    expect(result.createdAt).toBe(now)
    expect(result.value).toBe('x')
  })

  it('handles null and undefined', async () => {
    expect(await decryptDeep(null)).toBeNull()
    expect(await decryptDeep(undefined)).toBeUndefined()
  })

  it('handles primitive values', async () => {
    expect(await decryptDeep('hello')).toBe('hello')
    expect(await decryptDeep(42)).toBe(42)
    expect(await decryptDeep(true)).toBe(true)
  })

  it('handles an empty object', async () => {
    expect(await decryptDeep({})).toEqual({})
  })

  it('handles an empty array', async () => {
    expect(await decryptDeep([])).toEqual([])
  })
})

describe('transformWriteArgs', () => {
  const M = 'Secret'
  const AAD = 'Secret.value'

  it('encrypts data for create', async () => {
    const result = await transformWriteArgs(
      { data: { value: 'secret', name: 'keep' } },
      'create',
      ['value'],
      M
    )

    await expectCipher(result.data.value, 'secret', AAD)
    expect(result.data.name).toBe('keep')
  })

  it('encrypts data for update (plain shape)', async () => {
    const result = await transformWriteArgs(
      { where: { id: '1' }, data: { value: 'secret' } },
      'update',
      ['value'],
      M
    )

    await expectCipher(result.data.value, 'secret', AAD)
    expect(result.where).toEqual({ id: '1' })
  })

  it('encrypts data for update (atomic { set } shape)', async () => {
    const result = await transformWriteArgs(
      { where: { id: '1' }, data: { value: { set: 'secret' } } },
      'update',
      ['value'],
      M
    )

    await expectCipher(result.data.value.set, 'secret', AAD)
  })

  it.each(['updateMany', 'updateManyAndReturn'])(
    'encrypts data for %s',
    async (op) => {
      const result = await transformWriteArgs(
        { where: { userId: 'u1' }, data: { value: 'x' } },
        op,
        ['value'],
        M
      )

      await expectCipher(result.data.value, 'x', AAD)
    }
  )

  it.each(['createMany', 'createManyAndReturn'])(
    'encrypts each item for %s with array data',
    async (op) => {
      const result = await transformWriteArgs(
        { data: [{ value: 'a' }, { value: 'b' }] },
        op,
        ['value'],
        M
      )

      await expectCipher(result.data[0].value, 'a', AAD)
      await expectCipher(result.data[1].value, 'b', AAD)
    }
  )

  it('encrypts single-object data for createMany', async () => {
    const result = await transformWriteArgs(
      { data: { value: 'single' } },
      'createMany',
      ['value'],
      M
    )

    await expectCipher(result.data.value, 'single', AAD)
  })

  it('encrypts both create and update branches in upsert', async () => {
    const result = await transformWriteArgs(
      {
        where: { id: '1' },
        create: { value: 'cre' },
        update: { value: 'upd' },
      },
      'upsert',
      ['value'],
      M
    )

    await expectCipher(result.create.value, 'cre', AAD)
    await expectCipher(result.update.value, 'upd', AAD)
  })

  it('does not mutate the original args', async () => {
    const args = { data: { value: 'secret' } }

    await transformWriteArgs(args, 'create', ['value'], M)

    expect(args.data.value).toBe('secret')
  })
})

describe('key handling', () => {
  const current = () => process.env.PRISMA_FIELD_ENCRYPTION_KEY

  it('encrypts under the first key of the chain', async () => {
    const [k1, k2] = [generateKey(), generateKey()]

    const stored = await withKey(`${k1},${k2}`, () =>
      cipher('x', 'Secret.value')
    )

    // @note only k1 can open it
    await expect(
      withKey(k1, () => decryptColumn(stored, 'Secret.value'))
    ).resolves.toBe('x')
    await expect(
      withKey(k2, () => decryptColumn(stored, 'Secret.value'))
    ).rejects.toThrow(/not available/)
  })

  it('reads rows under an older key in the chain (rotation)', async () => {
    const old = current()
    const fresh = generateKey()

    const underOld = await cipher('before-rotation', 'Secret.value')

    await withKey(`${fresh},${old}`, async () => {
      const result = await decryptDeep({ value: underOld }, 'Secret')

      expect(result.value).toBe('before-rotation')

      // @note new writes go under the new key
      const underNew = await encryptTopLevelFields(
        { value: 'after' },
        ['value'],
        'Secret'
      )

      expect(getMessageKeyFingerprint(underNew.value)).not.toBe(
        getMessageKeyFingerprint(underOld)
      )
      expect(getMessageKeyFingerprint(underNew.value)).toBe(
        (await parseKey(fresh)).fingerprint
      )
    })
  })

  it('fails closed once the old key is dropped from the chain', async () => {
    const underOld = await cipher('gone', 'Secret.value')

    await expect(
      withKey(generateKey(), () => decryptDeep({ value: underOld }, 'Secret'))
    ).rejects.toThrow(/Unable to decrypt Secret.value/)
  })

  it('rejects a malformed key on the first encrypted write', async () => {
    await expect(
      withKey('dummy', () =>
        encryptTopLevelFields({ value: 'x' }, ['value'], 'Secret')
      )
    ).rejects.toThrow(/Unknown key format/)
  })

  it('reports encryption as disabled only when the variable is empty', async () => {
    await withKey('', () => expect(isFieldEncryptionEnabled()).toBe(false))
    await withKey(' , ', () => expect(isFieldEncryptionEnabled()).toBe(false))
    await withKey(generateKey(), () =>
      expect(isFieldEncryptionEnabled()).toBe(true)
    )
  })

  it('trims and ignores empty entries in the chain', async () => {
    const k = generateKey()

    await withKey(` ${k} , `, async () => {
      expect(getFieldEncryptionKeys()).toEqual([k])
    })
  })
})

describe('withEncryption', () => {
  it('returns a Prisma extension', () => {
    const ext = withEncryption()

    expect(ext).toBeDefined()
    // Prisma.defineExtension returns a function to be used with $extends
    expect(typeof ext).toBe('function')
  })
})

// ---
// Against real rows: writes through the application client (every extension
// chained as in production), reads back with `$queryRaw` on a raw client so
// the stored form is what is asserted on. Runs against the SQLite database
// the unit environment provisions - a file: url whose file exists, as the
// application job's `db:push` leaves it. Checking for an existing file avoids
// creating a new database accidentally when a file URL is configured but has
// not been provisioned. Skipped, loudly, otherwise because it writes rows.
// ---

const url = process.env.PRISMA_DATABASE_URL || ''

const databaseFile = url.startsWith('file:')
  ? path.resolve(process.cwd(), url.slice('file:'.length))
  : null

const hasDatabase = !!databaseFile && fs.existsSync(databaseFile)

const describeWithDatabase = hasDatabase ? describe : describe.skip

if (!hasDatabase) {
  // eslint-disable-next-line no-console
  console.warn(
    `encryption.utest: real-row cases skipped - PRISMA_DATABASE_URL is not a provisioned file: url (${
      url || 'unset'
    })`
  )
}

function ivOf(message) {
  return message.split('.')[3]
}

describeWithDatabase('column encryption against real rows', () => {
  let raw

  let userId

  beforeAll(async () => {
    raw = createRawInstance()

    const user = await prisma.user.create({
      data: { email: `encryption-${Date.now()}@example.test` },
    })

    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } })
    }

    await raw.$disconnect()
  })

  const rawSecretValue = async (id) => {
    const rows = await raw.$queryRaw`SELECT value FROM Secret WHERE id = ${id}`

    return rows[0]?.value ?? null
  }

  it('stores Secret.value as a cloak message and reads it back as plaintext', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'a', value: 'plain-secret' },
    })

    // @note the create result is decrypted too
    expect(secret.value).toBe('plain-secret')

    await expectCipher(
      await rawSecretValue(secret.id),
      'plain-secret',
      'Secret.value'
    )

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
    })

    expect(read.value).toBe('plain-secret')
  })

  it('uses a unique IV and ciphertext for identical plaintexts', async () => {
    const [a, b] = await Promise.all([
      prisma.secret.create({ data: { userId, name: 'a', value: 'same' } }),
      prisma.secret.create({ data: { userId, name: 'b', value: 'same' } }),
    ])

    const [ra, rb] = await Promise.all([
      rawSecretValue(a.id),
      rawSecretValue(b.id),
    ])

    expect(ra).not.toBe(rb)
    expect(ivOf(ra)).not.toBe(ivOf(rb))
  })

  it('encrypts on update in both the plain and the { set } shape', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'u', value: 'v1' },
    })
    const first = await rawSecretValue(secret.id)

    await prisma.secret.update({
      where: { id: secret.id },
      data: { value: 'v2' },
    })

    const second = await rawSecretValue(secret.id)

    await prisma.secret.update({
      where: { id: secret.id },
      data: { value: { set: 'v3' } },
    })

    const third = await rawSecretValue(secret.id)

    for (const stored of [first, second, third]) {
      expect(stored).toMatch(CLOAK_PREFIX)
    }

    expect(new Set([first, second, third]).size).toBe(3)

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
    })

    expect(read.value).toBe('v3')
  })

  it('stores plaintext when PRISMA_FIELD_ENCRYPTION_KEY is unset', async () => {
    const key = process.env.PRISMA_FIELD_ENCRYPTION_KEY

    process.env.PRISMA_FIELD_ENCRYPTION_KEY = ''

    try {
      const secret = await prisma.secret.create({
        data: { userId, name: 'off', value: 'no-key' },
      })

      expect(await rawSecretValue(secret.id)).toBe('no-key')

      const read = await prisma.secret.findUniqueOrThrow({
        where: { id: secret.id },
      })

      expect(read.value).toBe('no-key')
    } finally {
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = key
    }
  })

  it('leaves null untouched', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'n', value: null },
    })

    expect(await rawSecretValue(secret.id)).toBeNull()
  })

  it('encrypts SecretValue.value and GooglechatIntegration.serviceAccountKey', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 's', kind: 'personal' },
    })

    const value = await prisma.secretValue.create({
      data: { userId, secretId: secret.id, value: 'per-contact' },
    })

    const integration = await prisma.googlechatIntegration.create({
      data: { userId, serviceAccountKey: '{"private_key":"pem"}' },
    })

    const [valueRows, integrationRows] = await Promise.all([
      raw.$queryRaw`SELECT value FROM SecretValue WHERE id = ${value.id}`,
      raw.$queryRaw`SELECT serviceAccountKey FROM GooglechatIntegration WHERE id = ${integration.id}`,
    ])

    await expectCipher(valueRows[0].value, 'per-contact', 'SecretValue.value')
    await expectCipher(
      integrationRows[0].serviceAccountKey,
      '{"private_key":"pem"}',
      'GooglechatIntegration.serviceAccountKey'
    )

    const read = await prisma.googlechatIntegration.findUniqueOrThrow({
      where: { id: integration.id },
    })

    expect(read.serviceAccountKey).toBe('{"private_key":"pem"}')
  })

  it('decrypts include-d relations', async () => {
    const secret = await prisma.secret.create({
      data: {
        userId,
        name: 'i',
        value: 'parent',
        secretValues: { create: [{ userId, value: 'child' }] },
      },
      include: { secretValues: true },
    })

    // @note nested writes are documented as NOT encrypted by the extension;
    // the row above was written in plaintext and must still read back
    expect(secret.secretValues[0].value).toBe('child')

    // encrypt it through its own model, then read through the parent
    await prisma.secretValue.update({
      where: { id: secret.secretValues[0].id },
      data: { value: 'child' },
    })

    const rows =
      await raw.$queryRaw`SELECT value FROM SecretValue WHERE id = ${secret.secretValues[0].id}`

    expect(rows[0].value).toMatch(CLOAK_PREFIX)

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
      include: { secretValues: true, user: true },
    })

    expect(read.value).toBe('parent')
    expect(read.secretValues[0].value).toBe('child')
  })

  it('rejects a ciphertext moved into another column by raw SQL', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'm', value: 'moved' },
    })

    const integration = await prisma.googlechatIntegration.create({
      data: { userId },
    })

    const stolen = await rawSecretValue(secret.id)

    expect(isCloaked(stolen)).toBe(true)

    await raw.$executeRaw`UPDATE GooglechatIntegration SET serviceAccountKey = ${stolen} WHERE id = ${integration.id}`

    await expect(
      prisma.googlechatIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      })
    ).rejects.toThrow(
      /Unable to decrypt GooglechatIntegration.serviceAccountKey/
    )

    // @note a row that no longer decrypts is still deletable through the
    // application client (and the backfill below must not meet it - it
    // stops on a value no key or binding accepts, by design)
    const deleted = await prisma.googlechatIntegration.delete({
      where: { id: integration.id },
    })

    expect(deleted.serviceAccountKey).toBe(stolen)
  })

  const rawSecretConfig = async (id) => {
    const rows =
      await raw.$queryRaw`SELECT config FROM Secret WHERE id = ${id}`

    return rows[0]?.config ?? null
  }

  it('stores Secret.config as one cloak string and reads it back as the document', async () => {
    const config = {
      clientId: 'id',
      clientSecret: 'client-hush',
      tokenUrl: 'https://idp.example.test/token',
    }

    const secret = await prisma.secret.create({
      data: { userId, name: 'c', type: 'oauth', config },
    })

    expect(secret.config).toEqual(config)

    // @note the raw client parses the Json column, so a stored string scalar
    // comes back as the bare cloak message
    const stored = await rawSecretConfig(secret.id)

    expect(stored).not.toContain('client-hush')
    expect(stored).not.toContain('tokenUrl')

    await expectCipher(stored, JSON.stringify(config), 'Secret.config')

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
      select: { config: true, value: true },
    })

    expect(read.config).toEqual(config)

    const listed = await prisma.secret.findMany({
      where: { id: secret.id },
      select: { config: true },
    })

    expect(listed[0].config).toEqual(config)
  })

  it('re-encrypts the merged document on update', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'cu', config: { clientId: 'a', scope: 'x' } },
    })

    const before = await rawSecretConfig(secret.id)

    // @note the read-merge-write every config writer does
    const merged = { ...secret.config, clientSecret: 'added' }

    const updated = await prisma.secret.update({
      where: { id: secret.id },
      data: { config: merged },
    })

    expect(updated.config).toEqual(merged)

    const after = await rawSecretConfig(secret.id)

    expect(after).not.toBe(before)
    expect(after).not.toContain('added')

    await expectCipher(after, JSON.stringify(merged), 'Secret.config')
  })

  it('reads a plaintext config document written before the extension', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'legacy-config' },
    })

    await raw.$executeRaw`UPDATE Secret SET config = ${JSON.stringify({
      clientId: 'plain',
    })} WHERE id = ${secret.id}`

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
    })

    expect(read.config).toEqual({ clientId: 'plain' })
  })

  it('stores the config document in plaintext when the key is unset', async () => {
    const key = process.env.PRISMA_FIELD_ENCRYPTION_KEY

    process.env.PRISMA_FIELD_ENCRYPTION_KEY = ''

    try {
      const secret = await prisma.secret.create({
        data: { userId, name: 'off-config', config: { clientId: 'open' } },
      })

      expect(await rawSecretConfig(secret.id)).toEqual({ clientId: 'open' })

      const read = await prisma.secret.findUniqueOrThrow({
        where: { id: secret.id },
      })

      expect(read.config).toEqual({ clientId: 'open' })
    } finally {
      process.env.PRISMA_FIELD_ENCRYPTION_KEY = key
    }
  })

  it('leaves a null config untouched', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'nc', config: null },
    })

    expect(await rawSecretConfig(secret.id)).toBeNull()
    expect(secret.config).toBeNull()
  })

  it('decrypts the config document of an include-d secret', async () => {
    const config = { clientSecret: 'via-include' }

    const secret = await prisma.secret.create({
      data: { userId, name: 'inc', value: 'inc-value', config },
    })

    // @note User has no encrypted columns of its own; the walk happens
    // because the query includes a relation that does
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { secrets: { where: { id: secret.id } } },
    })

    expect(user.secrets[0].value).toBe('inc-value')
    expect(user.secrets[0].config).toEqual(config)

    const selected = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { secrets: { where: { id: secret.id }, select: { config: true } } },
    })

    expect(selected.secrets[0].config).toEqual(config)
  })

  it('reads plaintext rows written before the extension', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'legacy' },
    })

    await raw.$executeRaw`UPDATE Secret SET value = ${'legacy-plain'} WHERE id = ${
      secret.id
    }`

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
    })

    expect(read.value).toBe('legacy-plain')
  })

  it('keeps an already-encrypted value as is on write', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'idem', value: 'once' },
    })

    const stored = await rawSecretValue(secret.id)

    await prisma.secret.update({
      where: { id: secret.id },
      data: { value: stored },
    })

    expect(await rawSecretValue(secret.id)).toBe(stored)
  })

  it('encrypts upsert, createMany and updateMany, and decrypts findMany', async () => {
    const id = `upsert-${Date.now()}`

    await prisma.secret.upsert({
      where: { id },
      create: { id, userId, name: 'up', value: 'created' },
      update: { value: 'updated' },
    })

    await expectCipher(await rawSecretValue(id), 'created', 'Secret.value')

    await prisma.secret.upsert({
      where: { id },
      create: { id, userId, name: 'up', value: 'created' },
      update: { value: 'updated' },
    })

    await expectCipher(await rawSecretValue(id), 'updated', 'Secret.value')

    await prisma.secret.createMany({
      data: [
        { userId, name: 'many-1', value: 'm1' },
        { userId, name: 'many-2', value: 'm2' },
      ],
    })

    const many = await prisma.secret.findMany({
      where: { userId, name: { startsWith: 'many-' } },
      orderBy: { name: 'asc' },
    })

    expect(many.map((s) => s.value)).toEqual(['m1', 'm2'])

    for (const row of many) {
      await expectCipher(
        await rawSecretValue(row.id),
        row.value,
        'Secret.value'
      )
    }

    await prisma.secret.updateMany({
      where: { userId, name: { startsWith: 'many-' } },
      data: { value: 'bulk' },
    })

    for (const row of many) {
      await expectCipher(await rawSecretValue(row.id), 'bulk', 'Secret.value')
    }
  })

  it('leaves models without encrypted fields alone', async () => {
    const bot = await prisma.bot.create({
      data: { userId, name: 'plain-bot', backstory: 'v1.aesgcm256.lookalike' },
    })

    const rows =
      await raw.$queryRaw`SELECT backstory FROM Bot WHERE id = ${bot.id}`

    expect(rows[0].backstory).toBe('v1.aesgcm256.lookalike')
    expect(bot.backstory).toBe('v1.aesgcm256.lookalike')
  })

  it('reads rows under an older key after rotation, through the client', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'rot', value: 'survives' },
    })

    const before = await rawSecretValue(secret.id)
    const old = process.env.PRISMA_FIELD_ENCRYPTION_KEY
    const fresh = generateKey()

    await withKey(`${fresh},${old}`, async () => {
      const read = await prisma.secret.findUniqueOrThrow({
        where: { id: secret.id },
      })

      expect(read.value).toBe('survives')

      await prisma.secret.update({
        where: { id: secret.id },
        data: { value: 'rewritten' },
      })

      const after = await rawSecretValue(secret.id)

      expect(getMessageKeyFingerprint(after)).not.toBe(
        getMessageKeyFingerprint(before)
      )
    })

    // @note back on the old key alone the rewritten row no longer reads -
    // the documented reason the old key is dropped only after the backfill
    await expect(
      prisma.secret.findUniqueOrThrow({ where: { id: secret.id } })
    ).rejects.toThrow(/Unable to decrypt Secret.value/)

    await prisma.secret.update({
      where: { id: secret.id },
      data: { value: 'survives' },
    })
  })

  it('returns ciphertext as stored once the key is removed', async () => {
    const secret = await prisma.secret.create({
      data: { userId, name: 'removed', value: 'locked' },
    })

    const stored = await rawSecretValue(secret.id)

    await withKey('', async () => {
      const read = await prisma.secret.findUniqueOrThrow({
        where: { id: secret.id },
      })

      expect(read.value).toBe(stored)
    })

    const read = await prisma.secret.findUniqueOrThrow({
      where: { id: secret.id },
    })

    expect(read.value).toBe('locked')
  })

  const EXTRA_DATA = {
    Account: { type: 'oauth', provider: 'test', providerAccountId: 'acct' },
  }

  const covered = ['Secret', 'SecretValue', 'GooglechatIntegration']

  it.each(
    Object.entries(ENCRYPTED_FIELDS).filter(
      ([model]) => !covered.includes(model)
    )
  )('encrypts every annotated column of %s', async (model, fields) => {
    const delegate = model.charAt(0).toLowerCase() + model.slice(1)

    const data = {
      userId,
      ...(EXTRA_DATA[model] || {}),
      ...Object.fromEntries(fields.map((f) => [f, `plain-${model}-${f}`])),
    }

    const row = await prisma[delegate].create({ data })

    for (const field of fields) {
      // @note the create result is decrypted
      expect(row[field]).toBe(`plain-${model}-${field}`)
    }

    const rows = await raw.$queryRawUnsafe(
      `SELECT ${fields
        .map((f) => `"${f}"`)
        .join(', ')} FROM "${model}" WHERE id = ?`,
      row.id
    )

    for (const field of fields) {
      await expectCipher(
        rows[0][field],
        `plain-${model}-${field}`,
        additionalDataFor(model, field)
      )
    }

    const read = await prisma[delegate].findUniqueOrThrow({
      where: { id: row.id },
    })

    for (const field of fields) {
      expect(read[field]).toBe(`plain-${model}-${field}`)
    }
  })

  it('works through the next-auth Prisma adapter for Account rows', async () => {
    // @note the adapter the app hands next-auth (`lib/auth.adapter.ts`) is
    // PrismaAdapter over this same extended client; its Proxy overrides
    // touch only createUser/updateSession, so the package adapter over the
    // client is the code path an OAuth sign-in takes for Account
    const adapter = PrismaAdapter(prisma)

    const account = {
      userId,
      type: 'oauth',
      provider: 'adapter-test',
      providerAccountId: `acct-${Date.now()}`,
      access_token: 'plain-adapter-access',
      refresh_token: 'plain-adapter-refresh',
      id_token: 'plain-adapter-id',
    }

    await adapter.linkAccount(account)

    const [stored] = await raw.$queryRawUnsafe(
      `SELECT id, access_token, refresh_token, id_token FROM "Account" WHERE provider = ? AND providerAccountId = ?`,
      account.provider,
      account.providerAccountId
    )

    await expectCipher(
      stored.access_token,
      'plain-adapter-access',
      additionalDataFor('Account', 'access_token')
    )
    await expectCipher(
      stored.refresh_token,
      'plain-adapter-refresh',
      additionalDataFor('Account', 'refresh_token')
    )
    await expectCipher(
      stored.id_token,
      'plain-adapter-id',
      additionalDataFor('Account', 'id_token')
    )

    // the sign-in lookup next-auth performs on every OAuth callback
    const user = await adapter.getUserByAccount({
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    })

    expect(user?.id).toBe(userId)

    const read = await prisma.account.findUniqueOrThrow({
      where: { id: stored.id },
    })

    expect(read.access_token).toBe('plain-adapter-access')

    await adapter.unlinkAccount({
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    })

    expect(
      await prisma.account.findUnique({ where: { id: stored.id } })
    ).toBeNull()
  })

  it('fails the first encrypted write on a malformed key, and writes nothing', async () => {
    await expect(
      withKey('dummy', () =>
        prisma.secret.create({ data: { userId, name: 'bad', value: 'x' } })
      )
    ).rejects.toThrow(/Unknown key format/)

    expect(await prisma.secret.count({ where: { userId, name: 'bad' } })).toBe(
      0
    )
  })
})
