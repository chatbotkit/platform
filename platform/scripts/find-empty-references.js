import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Find empty ID reference fields across all database tables.
 *
 * Usage:
 * ```bash
 * pnpm script:find-empty-references  # No options required
 * ```
 *
 * This script scans all tables for empty strings in ID reference columns
 * (columns ending with 'Id') which may indicate data integrity issues.
 */
runScript({
  name: 'find-empty-references',
  description: 'Find empty ID reference fields in database',
  options: {},
  handler: async () => {
    // Get all columns ending with Id (excluding userId and id)
    // @note NOT a TypedSQL target: queries INFORMATION_SCHEMA, a MySQL system
    // catalog that is not a Prisma model
    const columns = await prisma.$queryRaw`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%Id' 
        AND COLUMN_NAME NOT IN ('userId', 'id', 'appId', 'phoneNumberId')
        AND TABLE_SCHEMA = DATABASE()
        AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `

    log(`found ${columns.length} ID columns to check`)

    const results = []

    // Run queries for each column
    for (const column of columns) {
      try {
        log(`Checking ${column.TABLE_NAME}.${column.COLUMN_NAME}...`)

        const query = `SELECT COUNT(*) as empty_count FROM ${column.TABLE_NAME} WHERE ${column.COLUMN_NAME} = ""`
        // @note NOT a TypedSQL target: the table/column names are dynamic
        // identifiers (from INFORMATION_SCHEMA) that cannot be bound as parameters
        const result = await prisma.$queryRawUnsafe(query)

        const emptyCount = Number(result[0].empty_count)

        results.push({
          table: column.TABLE_NAME,
          column: column.COLUMN_NAME,
          dataType: column.DATA_TYPE,
          emptyCount: emptyCount,
        })

        if (emptyCount > 0) {
          log(`  🔍 Found ${emptyCount} empty records`)
        } else {
          // log(`  ✅ No empty records`)
        }
      } catch (error) {
        log(
          `  ❌ Error checking ${column.TABLE_NAME}.${column.COLUMN_NAME}:`,
          error.message
        )
        results.push({
          table: column.TABLE_NAME,
          column: column.COLUMN_NAME,
          dataType: column.DATA_TYPE,
          emptyCount: 'ERROR',
          error: error.message,
        })
      }
    }

    // Summary
    log('\n📊 SUMMARY:')
    log('='.repeat(50))

    const tablesWithEmptyIds = results.filter((r) => r.emptyCount > 0)

    if (tablesWithEmptyIds.length === 0) {
      log('✅ No empty ID fields found!')
    } else {
      log(`🔍 Found empty ID fields in ${tablesWithEmptyIds.length} places:`)
      tablesWithEmptyIds.forEach((result) => {
        log(
          `  • ${result.table}.${result.column}: ${result.emptyCount} empty records`
        )
      })
    }

    const errors = results.filter((r) => r.emptyCount === 'ERROR')

    if (errors.length > 0) {
      log(`\n❌ ${errors.length} queries failed:`)
      errors.forEach((result) => {
        log(`  • ${result.table}.${result.column}: ${result.error}`)
      })
    }
  },
})
