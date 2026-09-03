import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import pluralize from 'pluralize'
import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

function ps(input: string): string {
  return pluralize(input, 2)
}

interface Row {
  id: string
  [key: string]: unknown
}

class CRMObjectDriver extends GenericDriver<Row> {
  #token: string
  #tableName: string

  constructor({ token, tableName }: { token: string; tableName: string }) {
    super()

    this.#token = token
    this.#tableName = tableName
  }

  async describeColumns(): Promise<Column[]> {
    const url = new URL(
      `https://api.hubapi.com/crm/v3/properties/${this.#tableName}`
    )

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { results } = (await response.json()) as {
      results: {
        fieldType: string
        name: string
        options?: { label: string }[]
        calculated?: boolean
        modificationMetadata?: {
          readOnlyValue: boolean
        }
      }[]
    }

    return results
      .map(({ fieldType, name, options, calculated, modificationMetadata }) => {
        return {
          type: (fieldType === 'number'
            ? 'number'
            : 'string') as Column['type'],
          name,
          ...(options?.length
            ? { options: options.map((option) => option.label) }
            : {}),
          ...(calculated || modificationMetadata?.readOnlyValue
            ? { readOnly: true }
            : {}),
        }
      })
      .concat([{ type: 'string', name: 'id' }])
  }

  async doSelect(columns: string[], where?: WhereStatement) {
    const url = new URL(
      `https://api.hubapi.com/crm/v3/objects/${ps(this.#tableName)}/search`
    )

    const filterGroups: {
      filters: {
        propertyName: string
        operator: string
        value: string
      }[]
    }[] = []

    for (const or of where?.or || []) {
      const filters = or.and.map((filter) => {
        return {
          propertyName: filter.column,
          operator:
            {
              LIKE: 'CONTAINS_TOKEN',
              NOT_LIKE: 'NOT_CONTAINS_TOKEN',
            }[filter.operator] || filter.operator,
          value: (function (value) {
            if (filter.operator === 'LIKE' || filter.operator === 'NOT_LIKE') {
              return value.replaceAll('%', '')
            }

            return value
          })(filter.criteria.value),
        }
      })

      filterGroups.push({ filters })
    }

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(columns.length > 0 ? { properties: columns } : {}),
        ...(filterGroups.length > 0 ? { filterGroups } : {}),
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { results, lists } = (await response.json()) as {
      results?: { id: string; properties: Record<string, unknown> }[]
      lists?: { id: string; properties: Record<string, unknown> }[]
    }

    return (results || lists || []).map((result) => ({
      row: {
        id: result.id,
        ...Object.entries(result.properties).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value == null || value === '' ? undefined : value,
          }),
          {}
        ),
      },
    }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL(
      `https://api.hubapi.com/crm/v3/objects/${ps(this.#tableName)}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { id } = (await response.json()) as { id: string }

    return { id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(
      `https://api.hubapi.com/crm/v3/objects/${ps(this.#tableName)}/${row.id}`
    )

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(
      `https://api.hubapi.com/crm/v3/objects/${ps(this.#tableName)}/${row.id}`
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
}

const supportedCRMObjects = [
  'campaign',
  'company',
  'contact',
  'lead',
  'deal',
  'goal',
  'product',
  'ticket',
]

export default handler(
  schema,
  supportedCRMObjects.map((name) => ({
    database: 'crm',
    name,
  })),
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const tableName = getTableName(table)
    const objectName = pluralize(table.name, 1)

    if (table.database === 'crm' && supportedCRMObjects.includes(objectName)) {
      return new CRMObjectDriver({ token, tableName: objectName })
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
