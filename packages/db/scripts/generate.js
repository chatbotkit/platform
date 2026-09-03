/**
 * @file generate.js
 *
 * Generates this package's Prisma client, fully self-contained.
 *
 * TypedSQL typechecks the queries in prisma/sql against a live database, so a
 * throwaway file database is pushed first - which is the whole point of the
 * SQLite default: nothing to provision, nothing to reach.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import url from 'node:url'

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..')

const run = (command) =>
  execSync(command, {
    cwd: ROOT,
    stdio: 'inherit',

    // @note the generators (json, zod, pothos) are resolved off PATH by the
    // prisma CLI, so the package's own bin directory has to be on it
    env: {
      ...process.env,

      // @note generation always runs against its own throwaway database, never
      // whatever PRISMA_DATABASE_URL happens to point at
      PRISMA_DATABASE_URL: `file:${path.join(ROOT, 'prisma', '.dev.db')}`,

      PATH: `${path.join(ROOT, 'node_modules', '.bin')}:${process.env.PATH}`,
    },
  })

const databasePath = path.join(ROOT, 'prisma', '.dev.db')

await fs.rm(databasePath, { force: true })
await fs.writeFile(databasePath, '')

run('prisma db push --accept-data-loss')
run('prisma generate --sql')

// @note the zod generator needs the shared post-processing pass - it fixes the
// generated files (a shadowed `Record` type) and recreates the compatibility
// re-exports. Shared with every db module, so it lives in the spec.
run(
  `node ${createRequire(import.meta.url).resolve(
    '@chatbotkit-dev/db-spec/scripts/post-generate-zod.js'
  )} ${path.join(ROOT, 'prisma')}`
)
