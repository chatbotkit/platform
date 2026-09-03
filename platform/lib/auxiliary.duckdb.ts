import { captureException } from '@/lib/error'

import {
  type DuckDBConnection,
  type DuckDBResultReader,
  StatementType,
} from '@duckdb/node-api'

const DUCKDB_SANDBOX_SETTINGS = [
  `SET allowed_directories = []`,
  `SET allowed_paths = []`,
  `SET allow_community_extensions = false`,
  `SET allow_persistent_secrets = false`,
  `SET allow_unsigned_extensions = false`,
  `SET autoinstall_known_extensions = false`,
  `SET autoload_known_extensions = false`,
  `SET enable_external_access = false`,
  `SET lock_configuration = true`,
] as const

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
}

interface TableInfo {
  [tableName: string]: ColumnInfo[] | { error: string }
}

/**
 * Remove DuckDB's host access after the application has materialized the
 * caller's approved input tables. Configuration is locked last so later SQL
 * cannot restore file, network, secret or extension access.
 */
export async function lockDownDuckDB(
  connection: DuckDBConnection
): Promise<void> {
  for (const sql of DUCKDB_SANDBOX_SETTINGS) {
    await connection.run(sql)
  }
}

/**
 * Parse and execute one read-only query. DuckDB's parser supplies the
 * statement type, avoiding a text allowlist that comments, CTEs or nested SQL
 * could bypass.
 */
export async function runReadOnlyDuckDBQuery(
  connection: DuckDBConnection,
  sql: string
): Promise<DuckDBResultReader> {
  const statements = await connection.extractStatements(sql)

  if (statements.count !== 1) {
    throw new Error('DuckDB query must contain exactly one statement')
  }

  const statement = await statements.prepare(0)

  try {
    if (statement.statementType !== StatementType.SELECT) {
      throw new Error('DuckDB query must be a read-only SELECT statement')
    }

    return await statement.runAndReadAll()
  } finally {
    statement.destroySync()
  }
}

export async function introspectDatabase(
  connection: DuckDBConnection,
  tableNames: string[]
): Promise<TableInfo> {
  const tables: TableInfo = {}

  try {
    for (const tableName of tableNames) {
      try {
        const result = await connection.runAndReadAll(
          `DESCRIBE ${JSON.stringify(tableName)}`
        )

        const columns = result.getRowObjectsJson()

        tables[tableName] = columns.map((col) => ({
          name: String(col.column_name || ''),
          type: String(col.column_type || ''),
          nullable: col.null === 'YES',
        }))
      } catch (tableError) {
        tables[tableName] = {
          error: `Could not describe table: ${tableError.message}`,
        }
      }
    }
  } catch (e) {
    await captureException(e)
  }

  return tables
}
