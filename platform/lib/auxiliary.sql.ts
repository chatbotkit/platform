import type { Driver } from '@chatbotkit-dev/sql/driver'
import type { ShowStatement, Statement, Table } from '@chatbotkit-dev/sql/parse'
import { getTableName, parseSingle } from '@chatbotkit-dev/sql/parse'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'

import pluralize from 'pluralize'
import type { ZodSchema } from 'zod'

async function doShow(
  sql: ShowStatement,
  tables: { database?: string; name: string }[]
) {
  debug(`show`, { sql }).log('sql.handler.doShow')

  if (sql.table.name.toLowerCase() === 'tables') {
    return tables.map((table) => {
      return {
        DATABASE_NAME: table.database,
        TABLE_NAME: table.name,
        FULL_NAME: `${table.database}.${table.name}`,
      }
    })
  }

  throw new Error(`Unknown table ${getTableName(sql.table)}`)
}

export default function makeHandler<T extends { sql: string }>(
  schema: ZodSchema<T>,
  tables: Table[],
  getDriver: (table: Table, parameters: T, headers: Headers) => Promise<Driver>,
  getTables?: (parameters: T, headers: Headers) => Promise<Table[]>
) {
  // @note every auxiliary route requires an authenticated platform session;
  // the session itself is not needed by the SQL drivers, which authenticate
  // to the upstream service with the caller-supplied provider token
  return authenticatedHandler(schema, async function (_session, parameters, headers) {
    debug(`handler`, { parameters, headers }).log(
      'sql.handler.makeHandler.handler'
    )

    const { sql } = parameters

    debug(`var`, { sql }).log('sql.handler.makeHandler.handler')

    let parsedSQL: Statement

    try {
      parsedSQL = parseSingle(sql)
    } catch (e) {
      throw new UserInputError(e.message)
    }

    debug(`parsedSQL`, { parsedSQL }).log('sql.handler.makeHandler.handler')

    let result: unknown

    const type = parsedSQL.type

    switch (type) {
      case 'show': {
        result = await doShow(
          parsedSQL,
          getTables ? await getTables(parameters, headers) : tables
        )

        break
      }

      case 'describe': {
        const driver = await getDriver(parsedSQL.table, parameters, headers)

        result = await driver.describe(parsedSQL)

        break
      }

      case 'select': {
        const driver = await getDriver(parsedSQL.table, parameters, headers)

        result = await driver.select(parsedSQL)

        break
      }

      case 'insert': {
        const driver = await getDriver(parsedSQL.table, parameters, headers)

        result = await driver.insert(parsedSQL)

        break
      }

      case 'update': {
        const driver = await getDriver(parsedSQL.table, parameters, headers)

        result = await driver.update(parsedSQL)

        break
      }

      case 'delete': {
        const driver = await getDriver(parsedSQL.table, parameters, headers)

        result = await driver.delete(parsedSQL)

        break
      }

      default: {
        assertUnreachable(type)
      }
    }

    debug(`received`, { result }).log('sql.handler.makeHandler.handler')

    return {
      sql,
      result,
    }
  })
}

export function makeHandler2<T extends { sql: string }>(
  schema: ZodSchema<T>,
  tables: (Table & {
    getDriver: (parameters: T, headers: Headers) => Promise<Driver>
  })[]
) {
  // @note every auxiliary route requires an authenticated platform session;
  // the session itself is not needed by the SQL drivers, which authenticate
  // to the upstream service with the caller-supplied provider token
  return authenticatedHandler(schema, async function (_session, parameters, headers) {
    debug(`handler`, { parameters, headers }).log(
      'sql.handler.makeHandler2.handler'
    )

    const { sql } = parameters

    debug(`var`, { sql }).log('sql.handler.makeHandler2.handler')

    let parsedSQL: Statement

    try {
      parsedSQL = parseSingle(sql)
    } catch (e) {
      throw new UserInputError(e.message)
    }

    debug(`parsedSQL`, { parsedSQL }).log('sql.handler.makeHandler2.handler')

    let result: unknown

    const type = parsedSQL.type

    const tableName = getTableName(parsedSQL.table)

    const table = tables.find(
      (table) => pluralize(tableName, 1) === pluralize(getTableName(table), 1)
    )

    if (!table) {
      throw new UserInputError(
        `Unknown table ${tableName} - available tables: ${tables
          .map(getTableName)
          .join(', ')}`
      )
    }

    const driver = await table.getDriver(parameters, headers)

    switch (type) {
      case 'show': {
        result = await doShow(parsedSQL, tables)

        break
      }

      case 'describe': {
        result = await driver.describe(parsedSQL)

        break
      }

      case 'select': {
        result = await driver.select(parsedSQL)

        break
      }

      case 'insert': {
        result = await driver.insert(parsedSQL)

        break
      }

      case 'update': {
        result = await driver.update(parsedSQL)

        break
      }

      case 'delete': {
        result = await driver.delete(parsedSQL)

        break
      }

      default: {
        assertUnreachable(type)
      }
    }

    debug(`received`, { result }).log('sql.handler.makeHandler2.handler')

    return {
      sql,
      result,
    }
  })
}
