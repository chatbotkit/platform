import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Find empty name/description fields across all database tables.
 *
 * Usage:
 * ```bash
 * pnpm script:find-empty-basic-info  # No options required
 * ```
 *
 * This script scans all tables for empty strings or NULL values in name/description
 * columns and provides suggested UPDATE queries to fix them.
 */
runScript({
  name: 'find-empty-basic-info',
  description: 'Find empty name/description fields in database',
  options: {},
  handler: async () => {
    // Get all columns with name 'name' or 'description'
    // @note NOT a TypedSQL target: queries INFORMATION_SCHEMA, a MySQL system
    // catalog that is not a Prisma model
    const columns = await prisma.$queryRaw`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME IN ('name', 'description')
        AND TABLE_SCHEMA = DATABASE()
        AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `

    log(`found ${columns.length} name/description columns to check`)

    const results = []

    // Run queries for each column
    for (const column of columns) {
      try {
        log(`Checking ${column.TABLE_NAME}.${column.COLUMN_NAME}...`)

        // Check for both empty strings and NULL values
        const query = `SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN ${column.COLUMN_NAME} = "" THEN 1 ELSE 0 END) as empty_string_count,
          SUM(CASE WHEN ${column.COLUMN_NAME} IS NULL THEN 1 ELSE 0 END) as null_count,
          SUM(CASE WHEN ${column.COLUMN_NAME} = "" OR ${column.COLUMN_NAME} IS NULL THEN 1 ELSE 0 END) as empty_or_null_count
        FROM ${column.TABLE_NAME}`

        // @note NOT a TypedSQL target: the table/column names are dynamic
        // identifiers (from INFORMATION_SCHEMA) that cannot be bound as parameters
        const result = await prisma.$queryRawUnsafe(query)

        const totalCount = Number(result[0].total_count)
        const emptyStringCount = Number(result[0].empty_string_count)
        const nullCount = Number(result[0].null_count)
        const emptyOrNullCount = Number(result[0].empty_or_null_count)

        results.push({
          table: column.TABLE_NAME,
          column: column.COLUMN_NAME,
          dataType: column.DATA_TYPE,
          totalCount: totalCount,
          emptyStringCount: emptyStringCount,
          nullCount: nullCount,
          emptyOrNullCount: emptyOrNullCount,
        })

        if (emptyOrNullCount > 0) {
          log(`  🔍 Found issues:`)

          if (emptyStringCount > 0) {
            log(`    - ${emptyStringCount} empty strings ("")`)
          }

          if (nullCount > 0) {
            log(`    - ${nullCount} NULL values`)
          }

          log(`    - Total: ${emptyOrNullCount}/${totalCount} records affected`)
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
          totalCount: 0,
          emptyStringCount: 'ERROR',
          nullCount: 'ERROR',
          emptyOrNullCount: 'ERROR',
          error: error.message,
        })
      }
    }

    // Summary
    log('\n📊 SUMMARY:')
    log('='.repeat(50))

    const tablesWithEmptyFields = results.filter((r) => r.emptyOrNullCount > 0)

    if (tablesWithEmptyFields.length === 0) {
      log('✅ No empty name/description fields found!')
    } else {
      log(
        `🔍 Found empty name/description fields in ${tablesWithEmptyFields.length} places:`
      )
      tablesWithEmptyFields.forEach((result) => {
        log(`  • ${result.table}.${result.column}:`)
        log(`    - ${result.emptyStringCount} empty strings`)
        log(`    - ${result.nullCount} NULL values`)
        log(
          `    - ${result.emptyOrNullCount}/${result.totalCount} total affected`
        )
      })
    }

    const errors = results.filter((r) => r.emptyOrNullCount === 'ERROR')

    if (errors.length > 0) {
      log(`\n❌ ${errors.length} queries failed:`)
      errors.forEach((result) => {
        log(`  • ${result.table}.${result.column}: ${result.error}`)
      })
    }

    // Generate update queries for empty strings
    log('\n🔧 SUGGESTED UPDATE QUERIES:')
    log('='.repeat(50))

    const fieldsNeedingUpdate = results.filter((r) => r.emptyStringCount > 0)

    if (fieldsNeedingUpdate.length > 0) {
      log('To convert empty strings to NULL, run these queries:')
      fieldsNeedingUpdate.forEach((result) => {
        log(
          `UPDATE ${result.table} SET ${result.column} = NULL WHERE ${result.column} = '' LIMIT 5000;`
        )
      })
    } else {
      log('No empty strings found that need updating.')
    }
  },
})
