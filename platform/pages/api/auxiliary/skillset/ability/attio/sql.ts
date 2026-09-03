import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import pluralize from 'pluralize'
import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

interface Row {
  id: string
  [key: string]: unknown
}

interface AttioAttribute {
  api_slug: string
  title: string
  type: string
  is_writable: boolean
  is_multiselect: boolean
}

interface AttioObject {
  api_slug: string
}

/**
 * Driver for Attio CRM records (people, companies, and custom objects).
 *
 * @see https://docs.attio.com/rest-api/overview
 */
class AttioRecordDriver extends GenericDriver<Row> {
  #token: string
  #objectSlug: string
  #multiSelectSlugs: Set<string> = new Set()

  constructor({ token, objectSlug }: { token: string; objectSlug: string }) {
    super()

    this.#token = token
    this.#objectSlug = objectSlug
  }

  async describeColumns(): Promise<Column[]> {
    const url = new URL(
      `https://api.attio.com/v2/objects/${this.#objectSlug}/attributes`
    )

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { data } = (await response.json()) as {
      data: AttioAttribute[]
    }

    // @note cache multi-select slugs so doInsert/doUpdate can wrap scalars
    this.#multiSelectSlugs = new Set(
      data
        .filter(({ is_multiselect }) => is_multiselect)
        .map(({ api_slug }) => api_slug)
    )

    // @note map Attio attribute types to SQL column types
    return data
      .map(({ api_slug, type, is_writable }) => {
        return {
          type: (type === 'number' || type === 'currency'
            ? 'number'
            : 'string') as Column['type'],
          name: api_slug,
          ...(!is_writable ? { readOnly: true } : {}),
        }
      })
      .concat([
        { type: 'string' as Column['type'], name: 'id', readOnly: true },
      ])
  }

  async doSelect(columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    // @note if ID is specified, fetch single record directly
    if (properties['id']) {
      const url = new URL(
        `https://api.attio.com/v2/objects/${this.#objectSlug}/records/${
          properties['id']
        }`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const { data } = (await response.json()) as {
        data: { id: { record_id: string }; values: Record<string, unknown> }
      }

      return [{ row: this.#mapRecordToRow(data) }]
    }

    // @note use the query endpoint for listing/filtering records
    const url = new URL(
      `https://api.attio.com/v2/objects/${this.#objectSlug}/records/query`
    )

    // @note build filter from WHERE clause
    const filter = this.#buildFilterFromWhere(where)

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(filter ? { filter } : {}),
        limit: 500,
        offset: 0,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { data } = (await response.json()) as {
      data: { id: { record_id: string }; values: Record<string, unknown> }[]
    }

    return data.map((record) => ({ row: this.#mapRecordToRow(record) }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL(
      `https://api.attio.com/v2/objects/${this.#objectSlug}/records`
    )

    const values = this.#wrapMultiSelectValues(parameters)

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          values,
        },
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { data } = (await response.json()) as {
      data: { id: { record_id: string } }
    }

    return { id: data.id.record_id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(
      `https://api.attio.com/v2/objects/${this.#objectSlug}/records/${row.id}`
    )

    const values = this.#wrapMultiSelectValues(parameters)

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          values,
        },
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(
      `https://api.attio.com/v2/objects/${this.#objectSlug}/records/${row.id}`
    )

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  /**
   * Maps an Attio record response to a flat row object.
   */
  #mapRecordToRow(record: {
    id: { record_id: string }
    values: Record<string, unknown>
  }): Row {
    const values = record.values || {}

    // @note flatten Attio's nested values structure
    const flatValues: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          flatValues[key] = value
        } else {
          const normalizedValues = value.map((item) =>
            this.#normalizeValue(item)
          )

          flatValues[key] =
            normalizedValues.length === 1
              ? normalizedValues[0]
              : normalizedValues
        }
      } else {
        flatValues[key] = value
      }
    }

    return {
      id: record.id.record_id,
      ...flatValues,
    }
  }

  #normalizeValue(value: unknown): unknown {
    if (typeof value !== 'object' || value === null) {
      return value
    }

    if ('value' in value) {
      return value.value
    }

    if ('original_value' in value) {
      return value.original_value
    }

    if ('email_address' in value) {
      return value.email_address
    }

    if ('domain' in value) {
      return value.domain
    }

    if ('first_name' in value || 'last_name' in value) {
      const nameValue = value as {
        first_name?: unknown
        last_name?: unknown
      }
      const parts: string[] = []

      if (nameValue.first_name) {
        parts.push(String(nameValue.first_name))
      }

      if (nameValue.last_name) {
        parts.push(String(nameValue.last_name))
      }

      return parts.join(' ')
    }

    return JSON.stringify(value)
  }

  /**
   * Wraps scalar values in arrays for multi-select attributes so Attio
   * does not reject writes with a validation_type error.
   */
  #wrapMultiSelectValues(
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    const wrapped: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(parameters)) {
      if (this.#multiSelectSlugs.has(key) && !Array.isArray(value)) {
        wrapped[key] = [value]
      } else {
        wrapped[key] = value
      }
    }

    return wrapped
  }

  /**
   * Builds Attio filter from SQL WHERE clause.
   */
  #buildFilterFromWhere(
    where?: WhereStatement
  ): Record<string, unknown> | undefined {
    if (!where?.or?.length) {
      return undefined
    }

    // @note convert SQL OR/AND structure to Attio's filter format
    const orConditions = where.or
      .map((or) => {
        const andConditions = or.and
          .filter(({ column }) => column !== 'id')
          .map(({ column, operator, criteria }) => ({
            [column]: this.#convertOperator(operator, criteria.value),
          }))

        if (andConditions.length === 0) {
          return undefined
        }

        if (andConditions.length === 1) {
          return andConditions[0]
        }

        return { $and: andConditions }
      })
      .filter((condition) => condition !== undefined)

    if (orConditions.length === 0) {
      return undefined
    }

    if (orConditions.length === 1) {
      return orConditions[0]
    }

    return { $or: orConditions }
  }

  /**
   * Converts SQL operator to Attio filter format.
   */
  #convertOperator(
    operator: string,
    value: unknown
  ): Record<string, unknown> | unknown {
    switch (operator) {
      case '=':
        return value
      case '!=':
      case '<>':
        return { $not: value }
      case 'LIKE':
        return { $contains: String(value).replaceAll('%', '') }
      case 'NOT_LIKE':
        return { $not: { $contains: String(value).replaceAll('%', '') } }
      default:
        return value
    }
  }
}

/**
 * Standard Attio CRM objects that are always available.
 */
const standardObjects = ['people', 'companies']

async function listTables(
  token: string
): Promise<{ database: string; name: string }[]> {
  const url = new URL('https://api.attio.com/v2/objects')

  const response = await call(url.href, {
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const { data } = (await response.json()) as { data: AttioObject[] }

  return data.map(({ api_slug }) => ({
    database: 'attio',
    name: api_slug,
  }))
}

export default handler(
  schema,
  standardObjects.map((name) => ({
    database: 'attio',
    name,
  })),
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const tableName = getTableName(table)

    // @note normalize object name (singular to plural, or use as-is for custom objects)
    const objectSlug =
      table.database === 'attio' ? pluralize(table.name, 2) : table.name

    if (table.database === 'attio') {
      return new AttioRecordDriver({ token, objectSlug })
    }

    throw new Error(`No driver found for table ${tableName}`)
  },
  async (_parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    return listTables(token)
  }
)
