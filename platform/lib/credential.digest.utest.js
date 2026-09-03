/**
 * @jest-environment node
 */
import {
  DIGEST_FIELDS,
  DIGEST_PREFIX,
  digestCredential,
  isCredentialDigest,
} from '@/lib/credential.digest'

import fs from 'node:fs'
import path from 'node:path'

const SCHEMA = path.join(
  path.dirname(require.resolve('@chatbotkit-dev/db-spec/derive')),
  '..',
  'prisma',
  'schema.prisma'
)

function readAnnotatedFields(schema) {
  const result = {}
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

    if (model && /\/\/\/\s*@digest\b/.test(line)) {
      const field = line.trim().split(/\s+/)[0]

      result[model] = [...(result[model] || []), field]
    }
  }

  return result
}

describe('credential.digest', () => {
  it('creates a deterministic, versioned SHA-256 digest', async () => {
    await expect(digestCredential('sk-secret')).resolves.toBe(
      `${DIGEST_PREFIX}746b4ad1ca9129e1caf080bf9406d43531b8bbf97f42cc1597ee4f3d4663938e`
    )

    await expect(digestCredential('sk-secret')).resolves.toBe(
      await digestCredential('sk-secret')
    )
    await expect(digestCredential('sk-other')).resolves.not.toBe(
      await digestCredential('sk-secret')
    )
  })

  it('recognizes only complete stored digests', () => {
    expect(
      isCredentialDigest(
        `${DIGEST_PREFIX}746b4ad1ca9129e1caf080bf9406d43531b8bbf97f42cc1597ee4f3d4663938e`
      )
    ).toBe(true)
    expect(isCredentialDigest('sk-secret')).toBe(false)
    expect(isCredentialDigest(`${DIGEST_PREFIX}not-a-digest`)).toBe(false)
  })

  it('does not make runtime digesting idempotent', async () => {
    const storedDigest = await digestCredential('sk-secret')

    await expect(digestCredential(storedDigest)).resolves.not.toBe(storedDigest)
  })

  it('matches every /// @digest annotation in the schema exactly', () => {
    const annotated = readAnnotatedFields(fs.readFileSync(SCHEMA, 'utf8'))
    const normalize = (map) =>
      Object.fromEntries(
        Object.entries(map)
          .map(([model, fields]) => [model, [...fields].sort()])
          .sort(([a], [b]) => a.localeCompare(b))
      )

    expect(normalize(DIGEST_FIELDS)).toEqual(normalize(annotated))
  })
})
