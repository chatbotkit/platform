import 'dotenv/config'

import prisma from '@/prisma/client'
import {
  ENCRYPTED_FIELDS,
  ENCRYPTED_JSON_FIELDS,
  additionalDataFor,
  decryptColumn,
  getFieldEncryptionKeys,
  isCloaked,
} from '@/prisma/encryption'

import { exit, log, runScript } from '@/lib/script'

import { getMessageKeyFingerprint, parseKey } from '@chatbotkit-dev/cloak'
import { createInstance as createRawInstance } from '@chatbotkit-dev/db'

/**
 * Encrypt or re-encrypt every stored credential under the primary key.
 *
 * Walks every `<Model>.<field>` in ENCRYPTED_FIELDS and ENCRYPTED_JSON_FIELDS
 * and rewrites each value that is not already encrypted under the first
 * PRISMA_FIELD_ENCRYPTION_KEY with
 * its column binding: plaintext rows from before the key was set, rows under
 * an older key in the chain (rotation), and rows encrypted before column
 * binding existed. Reads are raw so the stored form is visible; writes go
 * through the application client, whose extension does the encrypting. Safe
 * to re-run: a value already in its final form is skipped. Refuses to run
 * without a key - there is nothing to encrypt under.
 *
 * Usage:
 * ```bash
 * pnpm script:backfill-database-encryption               # dry run: count only
 * pnpm script:backfill-database-encryption --execute     # rewrite what needs it
 * ```
 *
 * A dry run is the default; nothing is written without `--execute`.
 *
 * Rotation: prepend the new key to PRISMA_FIELD_ENCRYPTION_KEY, run this script,
 * then remove the old key. Do not remove it first - values still under it
 * become unreadable, and this script cannot recover them.
 */
runScript({
  name: 'backfill-database-encryption',
  description:
    'Encrypt or re-encrypt stored credentials under the primary key',
  options: {
    execute: {
      type: 'boolean',
      short: 'x',
      description: 'Write the changes (without it, only report what would change)',
    },
    'batch-size': {
      type: 'string',
      short: 'b',
      description: 'Rows per batch (default 100)',
    },
  },
  handler: async ({ execute, 'batch-size': batchSizeOption }) => {
    const keys = getFieldEncryptionKeys()

    if (keys.length === 0) {
      exit('PRISMA_FIELD_ENCRYPTION_KEY is not set - nothing to encrypt under')
    }

    const batchSize = Number(batchSizeOption) || 100
    const { fingerprint: primary } = await parseKey(keys[0])

    // @note no extensions, so values come back as stored
    const raw = createRawInstance()

    const totals = {
      scanned: 0,
      rewritten: 0,
      skipped: 0,
      plaintext: 0,
      rekeyed: 0,
      rebound: 0,
    }

    try {
      const models = new Set([
        ...Object.keys(ENCRYPTED_FIELDS),
        ...Object.keys(ENCRYPTED_JSON_FIELDS),
      ])

      for (const model of models) {
        const jsonFields = ENCRYPTED_JSON_FIELDS[model] || []
        const fields = [...(ENCRYPTED_FIELDS[model] || []), ...jsonFields]

        const delegate = model.charAt(0).toLowerCase() + model.slice(1)

        let cursor

        for (;;) {
          const rows = await raw[delegate].findMany({
            take: batchSize,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: Object.fromEntries([
              ['id', true],
              ...fields.map((f) => [f, true]),
            ]),
          })

          if (rows.length === 0) {
            break
          }

          cursor = rows[rows.length - 1].id

          for (const row of rows) {
            totals.scanned += 1

            const data = {}

            for (const field of fields) {
              const value = row[field]
              const json = jsonFields.includes(field)

              // @note a Json column holds its document as stored (object,
              // array, or a cloak string once encrypted); a scalar column
              // holds a string or nothing
              const empty = json
                ? value === null || value === undefined
                : typeof value !== 'string' || value === ''

              if (empty) {
                continue
              }

              const reason =
                typeof value === 'string'
                  ? await classify(value, model, field, primary)
                  : 'plaintext'

              if (!reason) {
                continue
              }

              totals[reason] += 1

              if (reason === 'plaintext') {
                data[field] = value
              } else {
                try {
                  const stored = await decryptStored(value, model, field)

                  data[field] = json ? JSON.parse(stored) : stored
                } catch (error) {
                  throw new Error(
                    `${model}.${field} on row ${row.id} cannot be decrypted with the configured keys (${error.message}) - restore the missing key to PRISMA_FIELD_ENCRYPTION_KEY and re-run; nothing was skipped`
                  )
                }
              }
            }

            if (Object.keys(data).length === 0) {
              totals.skipped += 1

              continue
            }

            totals.rewritten += 1

            if (execute) {
              await prisma[delegate].update({ where: { id: row.id }, data })
            }
          }

          log(
            `${model}: ${totals.scanned} scanned, ${totals.rewritten} to rewrite`
          )
        }
      }
    } finally {
      await raw.$disconnect()
    }

    log(
      `${execute ? 'rewrote' : 'would rewrite'} ${totals.rewritten} rows: ${totals.plaintext} plaintext, ${totals.rekeyed} under an old key, ${totals.rebound} unbound; ${totals.skipped} already current${execute ? '' : ' (dry run - pass --execute to write)'}`
    )
  },
})

/**
 * Returns why a stored value needs rewriting, or null when it is already
 * encrypted under the primary key with its column binding.
 */
async function classify(value, model, field, primary) {
  if (!isCloaked(value)) {
    return 'plaintext'
  }

  if (getMessageKeyFingerprint(value) !== primary) {
    return 'rekeyed'
  }

  try {
    await decryptColumn(value, additionalDataFor(model, field))

    return null
  } catch {
    return 'rebound'
  }
}

/**
 * Decrypts a stored value in whichever form it is in: bound to its column,
 * or the unbound legacy form.
 *
 * @throws when no configured key accepts the value
 */
async function decryptStored(value, model, field) {
  try {
    return await decryptColumn(value, additionalDataFor(model, field))
  } catch {
    return await decryptColumn(value)
  }
}
