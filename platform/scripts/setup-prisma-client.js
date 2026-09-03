import 'dotenv/config'

import { log, runScript } from '@/lib/script'

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'path'

/**
 * Generate the installed database module's Prisma client.
 *
 * Usage:
 * ```bash
 * pnpm script:setup-prisma-client  # No options required
 * ```
 *
 * @note the adaptor selection, the schema and the generated client all live in
 * `@chatbotkit-dev/db`, which pnpm resolves to whichever database module this
 * deployment installs. This script only finds that module and runs its own
 * `db:gen` - resolving through the package name is what keeps the platform
 * ignorant of which implementation is present.
 */
runScript({
  name: 'setup-prisma-client',
  description: "Generate the installed database module's Prisma client",
  options: {},
  handler: async () => {
    const require = createRequire(import.meta.url)

    const moduleDir = path.dirname(
      require.resolve('@chatbotkit-dev/db/package.json')
    )

    log(`generating database client in ${moduleDir}`)

    execSync('pnpm db:gen', { cwd: moduleDir, stdio: 'inherit' })
  },
})
