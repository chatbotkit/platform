// @note the community database: SQLite in a file.
//
// This package is the proof that the platform's data layer runs somewhere a
// laptop can be: the schema is derived from the blueprint in
// `@chatbotkit-dev/db-spec`, the client is generated against a file database
// this package creates itself, and the 48 analytics queries typecheck and run
// against it unchanged.
//
// It is not the platform's client yet - the shim in `platform/prisma` still
// generates in place. Wiring this in behind that seam is the next step, and
// deliberately a separate one.

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import { PrismaClient } from '../prisma/generated/prisma/client'

export { Prisma, PrismaClient } from '../prisma/generated/prisma/client'

export * as sql from '../prisma/generated/prisma/sql'

/**
 * @note resolved on first use, never at import - the convention every module
 * follows, so importing this package never requires it to be configured.
 *
 * @throws when the url is missing or not a file: url, naming what to set
 */
function getUrl(): string {
  const url = process.env.PRISMA_DATABASE_URL

  if (!url || !url.startsWith('file:')) {
    throw new Error(
      'PRISMA_DATABASE_URL must be a file: url for the SQLite database, e.g. file:./data/cbk.db'
    )
  }

  return url
}

/**
 * Constructs a raw client.
 *
 * @note raw on purpose, matching the contract every database module exports:
 * the platform's own extensions (audit, cache, retry, methods) are platform
 * behaviour and are applied by the platform over this, not baked in here. The
 * platform also owns the lifecycle of the one shared instance, which is why
 * this constructs rather than caches.
 *
 * @throws when the url is missing or not a file: url, naming what to set
 */
export function createInstance() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: getUrl() }),
  })
}

let client: PrismaClient | undefined

export function getClient(): PrismaClient {
  if (!client) {
    client = createInstance()
  }

  return client
}

/**
 * @note exported for tests, which need a fresh client per case.
 */
export function resetClient(): void {
  client = undefined
}

/**
 * @throws when the database cannot be opened or queried, naming what to set.
 */
export async function assertConfigured(): Promise<void> {
  try {
    await getClient().$queryRaw`SELECT 1`
  } catch (error) {
    throw new Error(
      `the SQLite database at ${process.env.PRISMA_DATABASE_URL} could not be opened, so nothing can be stored or read: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}
