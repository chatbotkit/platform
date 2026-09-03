import type {
  DeleteStatement,
  DescribeStatement,
  InsertStatement,
  SelectStatement,
  Table,
  UpdateStatement,
  WhereStatement,
} from './parse'
import { getTableName, getWhereProperties } from './parse'

export interface Driver {
  describe(sql: DescribeStatement): Promise<unknown>
  select(sql: SelectStatement): Promise<unknown>
  insert(sql: InsertStatement): Promise<unknown>
  update(sql: UpdateStatement): Promise<unknown>
  delete(sql: DeleteStatement): Promise<unknown>
}

export interface Column {
  name: string
  type: 'string' | 'number' | 'boolean'
  options?: string[]
  readOnly?: boolean
}

export abstract class GenericDriver<ROW extends object> implements Driver {
  abstract describeColumns(): Promise<Column[]>

  async validateColumns(
    table: Table,
    columns: string[],
    parameters: Record<string, unknown>
  ): Promise<Column[]> {
    // debug(`validateColumns`, {
    //   table,
    //   columns,
    //   parameters,
    // }).log('sql.driver.GenericDriver.validateColumns')

    const tableName = getTableName(table)

    columns = columns.filter((col) => col !== '*')

    const supportedColumns = await this.describeColumns()

    // debug(`supportedColumns`, { supportedColumns }).log(
    //   'sql.driver.GenericDriver.validateColumns'
    // )

    const unsupportedColumns =
      supportedColumns.length > 0
        ? columns.filter(
            (col) =>
              !supportedColumns.some(
                (p) => p.name.toLowerCase() === col.toLowerCase()
              )
          )
        : []

    // debug(`unsupportedColumns`, { unsupportedColumns }).log(
    //   'sql.driver.GenericDriver.validateColumns'
    // )

    if (unsupportedColumns.length > 0) {
      throw new Error(
        `The following columns do not exist in table ${tableName}: ${unsupportedColumns.join(
          ', '
        )}. Supported columns are: ${supportedColumns
          .map((p) => p.name)
          .join(', ')}`
      )
    }

    if (supportedColumns.length > 0) {
      for (const key of Object.keys(parameters)) {
        const column = supportedColumns.find(
          (p) => p.name.toLowerCase() === key.toLowerCase()
        )

        if (!column) {
          throw new Error(
            `The column ${key} does not exist in table ${tableName}. Supported columns are: ${supportedColumns
              .map((p) => p.name)
              .join(', ')}`
          )
        }
      }

      // @todo validate columns with enum values
    }

    return supportedColumns
  }

  async describe(sql: DescribeStatement) {
    // debug(`describe`, { sql }).log('sql.driver.GenericDriver.describe')

    sql

    return this.describeColumns()
  }

  abstract doSelect(
    columns: string[],
    where?: WhereStatement
  ): Promise<{ row: ROW; [key: string]: unknown }[]>

  async select(
    sql: SelectStatement
  ): Promise<{ row: ROW; [key: string]: unknown }[]> {
    // debug(`select`, { sql }).log('sql.driver.GenericDriver.select')

    const validColumns = await this.validateColumns(
      sql.table,
      sql.columns,
      sql.where ? getWhereProperties(sql.where) : {}
    )

    let columns: string[] = sql.columns.slice(0)

    if (columns.includes('*')) {
      columns = validColumns.map((field) => field.name)
    }

    const result = await this.doSelect(columns, sql.where)

    return result.map(({ row, ...rest }) => {
      return {
        ...rest,

        row: columns.reduce<Record<string, unknown>>((acc, col) => {
          acc[col] = (row as Record<string, unknown>)[col]

          return acc
        }, {}) as ROW,
      }
    })
  }

  abstract doInsert(parameters: Record<string, unknown>): Promise<unknown>

  async insert(sql: InsertStatement) {
    // debug(`insert`, { sql }).log('sql.driver.GenericDriver.insert')

    await this.validateColumns(
      sql.table,
      Object.keys(sql.parameters),
      sql.parameters
    )

    return await this.doInsert(sql.parameters)
  }

  abstract doUpdate(
    selectResult: { row: ROW; [key: string]: unknown },
    parameters: Record<string, unknown>
  ): Promise<void>

  async update(sql: UpdateStatement) {
    // debug(`update`, { sql }).log('sql.driver.GenericDriver.update')

    await this.validateColumns(
      sql.table,
      Object.keys(sql.parameters),
      sql.parameters
    )

    const results = await this.select({
      type: 'select',
      columns: ['id'],
      table: sql.table,
      where: sql.where,
    })

    if (results.length === 0) {
      return { updated: 0 }
    }

    if (results.length > 10) {
      // @todo revise this decision in the future

      throw new Error('Cannot update more than 10 rows at a time')
    }

    for (const result of results) {
      // debug(`result`, { result }).log('sql.driver.GenericDriver.update')

      await this.doUpdate(result, sql.parameters)
    }

    return { updated: results.length }
  }

  abstract doDelete(selectResult: {
    row: ROW
    [key: string]: unknown
  }): Promise<void>

  async delete(sql: DeleteStatement) {
    // debug(`delete`, { sql }).log('sql.driver.GenericDriver.delete')

    const results = await this.select({
      type: 'select',
      columns: ['id'],
      table: sql.table,
      where: sql.where,
    })

    if (results.length === 0) {
      return { deleted: 0 }
    }

    if (results.length > 10) {
      // @todo revise this decision in the future

      throw new Error('Cannot delete more than 10 rows at a time')
    }

    // @todo make run in parallel

    for (const result of results) {
      // debug(`result`, { result }).log('sql.driver.GenericDriver.delete')

      await this.doDelete(result)
    }

    return { deleted: results.length }
  }
}
