import 'dotenv/config'

import { log, runScript } from '@/lib/script'

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'path'

/**
 * Push the installed database module's schema to the configured database.
 *
 * Usage:
 * ```bash
 * pnpm db:push  # No options required
 * ```
 *
 * @note the schema lives in the installed database module - see
 * setup-prisma-client.js for the resolution pattern.
 */
runScript({
  name: 'db-push',
  description: "Push the installed database module's schema",
  options: {},
  handler: async () => {
    const require = createRequire(import.meta.url)

    const moduleDir = path.dirname(
      require.resolve('@chatbotkit-dev/db/package.json')
    )

    // @note the push runs inside the module directory, so a relative `file:`
    // url - which is what .env.example ships, because an absolute one cannot
    // be committed - would resolve against THAT directory instead of the
    // application's. The database then lands somewhere the application never
    // opens and the mismatch surfaces later as a failing query rather than
    // here. Absolutize it against the application before handing it over.
    const databaseUrl = process.env.PRISMA_DATABASE_URL

    const env = { ...process.env }

    if (databaseUrl?.startsWith('file:')) {
      const target = databaseUrl.slice('file:'.length)

      if (!path.isAbsolute(target)) {
        env.PRISMA_DATABASE_URL = `file:${path.resolve(process.cwd(), target)}`

        log(`resolved relative database path to ${env.PRISMA_DATABASE_URL}`)
      }
    }

    log(`pushing schema from ${moduleDir}`)

    execSync('pnpm db:push', { cwd: moduleDir, stdio: 'inherit', env })
  },
})
