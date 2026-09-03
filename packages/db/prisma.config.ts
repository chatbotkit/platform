import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// @note one variable, shared with the runtime. The generate step overrides it
// with a throwaway file so generation never touches a real database - TypedSQL
// needs a live database to typecheck the queries in prisma/sql against, and a
// file this package creates itself is the whole point of the default.
export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url:
      process.env.PRISMA_DATABASE_URL ||
      `file:${path.join(ROOT, 'prisma', '.dev.db')}`,
  },
})
