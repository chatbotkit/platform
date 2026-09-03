import 'dotenv/config'

import { validateSelectOnly } from '@chatbotkit-dev/sql'

import prisma from '@/prisma/client'

import { log, print, runScript } from '@/lib/script'

/**
 * Run a read-only SELECT SQL query against the Prisma database.
 *
 * Usage:
 * ```bash
 * pnpm script:prisma-query                                    # Interactive mode
 * pnpm script:prisma-query --query "SELECT * FROM User LIMIT 10"  # CLI mode
 * pnpm script:prisma-query -q "SELECT id, email FROM User LIMIT 5"
 * ```
 *
 * Features:
 * - Only SELECT statements are allowed (INSERT, UPDATE, DELETE are blocked)
 * - Results are limited to 100 rows if no LIMIT is specified
 * - Sensitive columns (tokens, secrets, passwords) are automatically redacted
 * - BigInt values are serialized as strings
 * - Supports aggregate functions (COUNT, SUM, etc.) and complex expressions
 *
 * @note For available table names and column definitions, refer to:
 * the installed database module (@chatbotkit-dev/db)
 */

/**
 * Columns considered sensitive and should be redacted from query results.
 */
const sensitiveColumns = [
  'accessToken',
  'refreshToken',
  'botToken',
  'verifyToken',
  'secret',
  'token',
  'password',
  'passwordHash',
  'apiKey',
  'privateKey',
]

runScript({
  name: 'prisma-query',
  description: 'Run a read-only SELECT SQL query against the Prisma database',
  options: {
    query: {
      type: 'string',
      short: 'q',
      description: 'The SELECT SQL query to execute',
      message: 'Enter the SELECT SQL query to execute:',
      required: true,
    },
  },
  handler: async ({ query }) => {
    // @note validate the SQL is a SELECT-only query using lightweight validation
    // that supports aggregate functions, aliases, and complex expressions

    const validation = validateSelectOnly(query)

    if (!validation.valid) {
      log(validation.error || 'Invalid SQL query')

      return
    }

    // @note add LIMIT if not present to prevent excessive results

    let safeQuery = query.trim()

    if (!/\bLIMIT\b/i.test(safeQuery)) {
      safeQuery = `${safeQuery.replace(/;$/, '')} LIMIT 100`
      log(`Added LIMIT 100 to query`)
    }

    log(`Executing query...`)

    try {
      // @note NOT a TypedSQL target: this is an ad-hoc arbitrary-SQL runner
      // tool; the query text is supplied at runtime
      const results = await prisma.$queryRawUnsafe(safeQuery)

      // @note redact sensitive columns from results

      const redactedResults = Array.isArray(results)
        ? results.map((row) => {
            const redactedRow = { ...row }

            for (const key of Object.keys(redactedRow)) {
              if (
                sensitiveColumns.some(
                  (col) => key.toLowerCase() === col.toLowerCase()
                )
              ) {
                redactedRow[key] = '[REDACTED]'
              }
            }

            return redactedRow
          })
        : results

      const rowCount = Array.isArray(redactedResults)
        ? redactedResults.length
        : 1

      log(`Query returned ${rowCount} row(s)`)
      print('')
      print(
        JSON.stringify(
          redactedResults,
          // @note handle BigInt serialization
          (_, v) => (typeof v === 'bigint' ? v.toString() : v),
          2
        )
      )
    } catch (err) {
      log(
        `Query execution failed: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      )
    }
  },
})
