import type {
  Binary as SQLBinary,
  Function as SQLFunction,
} from 'node-sql-parser'
import parser from 'node-sql-parser'

const Parser = parser.Parser

type Operator =
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'IN'
  | 'NOT_IN'
  | 'LIKE'
  | 'NOT_LIKE'

export interface Condition {
  column: string
  operator: Operator
  criteria: {
    type: 'string' | 'number' | 'boolean'
    value: string
  }
}

export type WhereStatement = {
  or: {
    and: Condition[]
  }[]
}

export type OrderStatement = {
  column: string
  direction: 'asc' | 'desc'
}[]

function stripTrailingReturningClause(sql: string): string {
  const trimmedSQL = sql.trim()

  if (!/^(insert|update|delete)\b/i.test(trimmedSQL)) {
    return trimmedSQL
  }

  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktickQuote = false
  let returningStart = -1

  for (let index = 0; index < trimmedSQL.length; index += 1) {
    const char = trimmedSQL[index]
    const nextChar = trimmedSQL[index + 1]

    if (inSingleQuote) {
      if (char === "'" && nextChar === "'") {
        index += 1

        continue
      }

      if (char === "'") {
        inSingleQuote = false
      }

      continue
    }

    if (inDoubleQuote) {
      if (char === '"' && nextChar === '"') {
        index += 1

        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (inBacktickQuote) {
      if (char === '`') {
        inBacktickQuote = false
      }

      continue
    }

    if (char === "'") {
      inSingleQuote = true

      continue
    }

    if (char === '"') {
      inDoubleQuote = true

      continue
    }

    if (char === '`') {
      inBacktickQuote = true

      continue
    }

    if (!/\breturning\b/i.test(trimmedSQL.slice(index, index + 9))) {
      continue
    }

    const previousChar = index === 0 ? ' ' : trimmedSQL[index - 1]
    const followingChar = trimmedSQL[index + 9] || ' '

    if (/\w/.test(previousChar) || /\w/.test(followingChar)) {
      continue
    }

    returningStart = index
  }

  return returningStart === -1
    ? trimmedSQL
    : trimmedSQL.slice(0, returningStart).trimEnd()
}

function getWhereStatement(
  where: SQLFunction | SQLBinary | null,
  acc: WhereStatement = { or: [] }
): WhereStatement {
  if (!where) {
    return acc
  }

  const type = where.type

  switch (type) {
    case 'function': {
      throw new Error('Functions are not supported')
    }

    case 'binary_expr': {
      const left = where.left
      const right = where.right
      const operator = where.operator

      switch (operator) {
        case 'AND': {
          if (where.parentheses) {
            throw new Error('Parentheses are not supported')
          }

          if ('value' in left) {
            throw new Error(
              'Left side of the binary expression is not a binary'
            )
          }

          if (!('type' in left && left.type === 'binary_expr')) {
            throw new Error(
              'Left side of the binary expression is not a binary'
            )
          }

          if ('value' in right) {
            throw new Error(
              'Right side of the binary expression is not a binary'
            )
          }

          if (!('type' in right && right.type === 'binary_expr')) {
            throw new Error(
              'Right side of the binary expression is not a binary'
            )
          }

          getWhereStatement(left, acc)
          getWhereStatement(right, acc)

          break
        }

        case 'OR': {
          if (where.parentheses) {
            throw new Error('Parentheses are not supported')
          }

          if ('value' in left) {
            throw new Error(
              'Left side of the binary expression is not a binary'
            )
          }

          if (!('type' in left && left.type === 'binary_expr')) {
            throw new Error(
              'Left side of the binary expression is not a binary'
            )
          }

          if ('value' in right) {
            throw new Error(
              'Right side of the binary expression is not a binary'
            )
          }

          if (!('type' in right && right.type === 'binary_expr')) {
            throw new Error(
              'Right side of the binary expression is not a binary'
            )
          }

          getWhereStatement(left, acc)

          acc.or.push({ and: [] })

          getWhereStatement(right, acc)

          break
        }

        default: {
          if (!('column' in left)) {
            throw new Error(
              'Left side of the binary expression is not a column'
            )
          }

          if (!('value' in right)) {
            throw new Error(
              'Right side of the binary expression is not a value'
            )
          }

          let lastAnd = acc.or[acc.or.length - 1]

          if (!lastAnd) {
            lastAnd = { and: [] }

            acc.or.push(lastAnd)
          }

          lastAnd.and.push({
            column: left.column as string,

            operator: (function (operator: string) {
              switch (operator) {
                case '=': {
                  return 'EQ'
                }
                case '!=': {
                  return 'NEQ'
                }

                case '>': {
                  return 'GT'
                }

                case '<': {
                  return 'LT'
                }

                case '>=': {
                  return 'GTE'
                }

                case '<=': {
                  return 'LTE'
                }

                case 'IN': {
                  return 'IN'
                }

                case 'NOT IN': {
                  return 'NOT_IN'
                }

                case 'LIKE': {
                  return 'LIKE'
                }

                case 'NOT LIKE': {
                  return 'NOT_LIKE'
                }

                default: {
                  throw new Error(`Unsupported operator: ${operator}`)
                }
              }
            })(operator),

            criteria: {
              type: ({
                single_quote_string: 'string',
                double_quote_string: 'string',
                number: 'number',
                boolean: 'boolean',
                string: 'string',
              }[right.type] || 'string') as 'string' | 'number' | 'boolean',
              value: right.value.toString(),
            },
          })

          break
        }
      }
    }
  }

  return acc
}

export interface Table {
  database?: string
  name: string
}

export interface ShowStatement {
  type: 'show'
  table: Table
}

export interface DescribeStatement {
  type: 'describe'
  table: Table
}

export interface SelectStatement {
  type: 'select'
  table: Table
  columns: string[]
  where?: WhereStatement
  order?: OrderStatement
  limit?: number
  offset?: number
}

export interface InsertStatement {
  type: 'insert'
  table: Table
  parameters: Record<string, unknown>
}

export interface UpdateStatement {
  type: 'update'
  table: Table
  parameters: Record<string, unknown>
  where: WhereStatement
}

export interface DeleteStatement {
  type: 'delete'
  table: Table
  where: WhereStatement
}

export type Statement =
  | ShowStatement
  | DescribeStatement
  | SelectStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement

export function parse(sql: string): Statement[] {
  // handle show in a different way because it is not supported
  {
    const match = sql.match(/^show\s+(?<database>[^.\s]+\.)?(?<table>[^\s]+)$/i)

    if (match) {
      const database = match.groups?.database?.slice(0, -1)
      const name = match.groups?.table as string

      return [
        {
          type: 'show',
          table: {
            ...(database && { database }),
            name: name,
          },
        },
      ]
    }
  }

  // handle describe in a different way because it is not supported
  {
    const match = sql.match(
      /^describe\s+(?<database>[^.\s]+\.)?(?<table>[^\s]+)$/i
    )

    if (match) {
      const database = match.groups?.database?.slice(0, -1)
      const name = match.groups?.table as string

      return [
        {
          type: 'describe',
          table: {
            ...(database && { database }),
            name: name,
          },
        },
      ]
    }
  }

  const parser = new Parser()

  // @note strip RETURNING clauses - not supported by the parser and handled
  // implicitly by drivers that always return the affected row

  const sanitizedSQL = stripTrailingReturningClause(sql)

  const parsedAST = parser.astify(sanitizedSQL)

  const parsedStatements = Array.isArray(parsedAST) ? parsedAST : [parsedAST]

  const statements: Statement[] = []

  for (const parsedSQL of parsedStatements) {
    switch (parsedSQL.type) {
      case 'select': {
        if (!Array.isArray(parsedSQL.from)) {
          throw new Error('Table name expressions are not supported')
        }

        if (parsedSQL.from.length !== 1) {
          throw new Error('Table joins and subqueries are not supported')
        }

        if (!('db' in parsedSQL.from[0])) {
          throw new Error('Database name is missing')
        }

        const databaseName = parsedSQL.from[0].db
        const tableName = parsedSQL.from[0].table

        if (!tableName) {
          throw new Error('Table name is missing')
        }

        const columns = parsedSQL.columns?.map((col) => {
          if (!col.expr.column) {
            throw new Error('Column name is missing')
          }

          return col.expr.column
        })

        const where = getWhereStatement(parsedSQL.where)

        const order =
          parsedSQL.orderby?.map(({ expr, type }) => ({
            column: expr.column as string,
            direction: ({
              ASC: 'asc',
              DESC: 'desc',
            }[type] || 'asc') as 'asc' | 'desc',
          })) || undefined

        const limit = parsedSQL.limit?.value[0]?.value || undefined

        const offset = parsedSQL.limit?.value[1]?.value || undefined

        statements.push({
          type: 'select',

          table: {
            ...(databaseName && { database: databaseName }),
            name: tableName,
          },

          columns,

          ...(where.or.length && { where }),

          ...(order && { order }),

          ...(limit && { limit }),

          ...(offset && { offset }),
        })

        break
      }

      case 'insert': {
        const sqlTable = parsedSQL.table?.[0] || {}

        const databaseName = sqlTable.db || ''
        const tableName = sqlTable.table || ''

        if (!tableName) {
          throw new Error('Table name is missing')
        }

        const columns = parsedSQL.columns || []

        const values = (function (values) {
          const result: string[] = []

          if (Array.isArray(values)) {
            for (const value of values) {
              if (value.type === 'expr_list') {
                result.push(
                  ...value.value.map((v: { value: { toString(): string } }) =>
                    v.value.toString()
                  )
                )
              }
            }
          }

          return result
        })(parsedSQL.values)

        const parameters = columns.reduce((acc, column, index) => {
          return {
            ...acc,

            [column]: values[index],
          }
        }, {})

        statements.push({
          type: 'insert',

          table: {
            ...(databaseName && { database: databaseName }),
            name: tableName,
          },

          parameters,
        })

        break
      }

      case 'update': {
        const sqlTable = parsedSQL.table?.[0] || {}

        // @ts-ignore - not sure why
        const databaseName: string = sqlTable.db || ''

        // @ts-ignore - not sure why
        const tableName: string = sqlTable.table || ''

        if (!tableName) {
          throw new Error('Table name is missing')
        }

        const parameters = parsedSQL.set.reduce((acc, { column, value }) => {
          return {
            ...acc,

            [column]: value.value,
          }
        }, {})

        const where = getWhereStatement(parsedSQL.where)

        statements.push({
          type: 'update',

          table: {
            ...(databaseName && { database: databaseName }),
            name: tableName,
          },

          parameters,

          where,
        })

        break
      }

      case 'delete': {
        const databaseName = parsedSQL.table?.[0]?.db
        const tableName = parsedSQL.table?.[0]?.table

        if (!tableName) {
          throw new Error('Table name is missing')
        }

        const where = getWhereStatement(parsedSQL.where)

        statements.push({
          type: 'delete',

          table: {
            ...(databaseName && { database: databaseName }),
            name: tableName,
          },

          where,
        })

        break
      }

      case 'replace': {
        throw new Error('REPLACE statements are not supported')
      }

      case 'use': {
        throw new Error('USE statements are not supported')
      }

      case 'alter': {
        throw new Error('ALTER statements are not supported')
      }

      case 'create': {
        throw new Error('CREATE statements are not supported')
      }

      case 'drop': {
        throw new Error('DROP statements are not supported')
      }

      default: {
        const x: never = parsedSQL

        x

        throw new Error(`Unsupported SQL operation`)
      }
    }
  }

  return statements
}

export function parseSingle(sql: string): Statement {
  const parsed = parse(sql)

  if (parsed.length === 0) {
    throw new Error('No SQL statements found')
  }

  if (parsed.length > 1) {
    throw new Error('Multiple SQL statements are not supported')
  }

  return parsed[0]
}

export function getWhereProperties(
  where: WhereStatement
): Record<string, string> {
  const properties: Record<string, string> = {}

  for (const or of where.or) {
    for (const and of or.and) {
      if (and.operator !== 'NOT_IN' && and.operator !== 'NOT_LIKE') {
        properties[and.column] = and.criteria.value
      }
    }
  }

  return properties
}

export function getTableName(table: Table): string {
  return table.database ? `${table.database}.${table.name}` : `${table.name}`
}

/**
 * Validates that all SQL statements in the query are SELECT statements. This is
 * a lightweight validation that doesn't fully parse the SQL structure, making
 * it suitable for validating complex queries with aggregate functions, aliases,
 * and quoted identifiers that the full parse() function doesn't support.
 *
 * @param sql - The SQL query string to validate
 * @returns An object with the validation result and any error message
 */
export function validateSelectOnly(sql: string): {
  valid: boolean
  error?: string
  statementTypes?: string[]
} {
  const parser = new Parser()

  try {
    const ast = parser.astify(sql.trim(), { database: 'MySQL' })
    const statements = Array.isArray(ast) ? ast : [ast]

    if (statements.length === 0) {
      return { valid: false, error: 'No valid SQL statements found in query.' }
    }

    const statementTypes = statements.map((s) => s.type)
    const nonSelectStatements = statements.filter((s) => s.type !== 'select')

    if (nonSelectStatements.length > 0) {
      const disallowedTypes = [
        ...new Set(nonSelectStatements.map((s) => s.type.toUpperCase())),
      ]

      return {
        valid: false,
        error: `Only SELECT queries are allowed. Found disallowed statement types: ${disallowedTypes.join(
          ', '
        )}`,
        statementTypes,
      }
    }

    return { valid: true, statementTypes }
  } catch (err) {
    return {
      valid: false,
      error: `Invalid SQL query: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`,
    }
  }
}
