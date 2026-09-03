import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
  domain: z.string(),
})

interface Row {
  id: string
  [key: string]: unknown
}

interface TicketField {
  id: string
  name: string
}

class ZendeskTicketDriver extends GenericDriver<Row> {
  #token: string
  #domain: string
  #fieldsCache: TicketField[] | null = null

  constructor({ token, domain }: { token: string; domain: string }) {
    super()

    this.#token = token
    this.#domain = domain
  }

  async fetchFields(): Promise<TicketField[]> {
    if (this.#fieldsCache) {
      return this.#fieldsCache
    }

    const url = new URL(
      `https://${this.#domain}.zendesk.com/api/v2/ticket_fields.json`
    )

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { ticket_fields } = (await response.json()) as {
      ticket_fields: { id: number; title: string; type: string }[]
    }

    this.#fieldsCache = ticket_fields.map((field) => {
      return {
        id: String(field.id),
        name: field.title.toLowerCase().replace(/\s+/g, '_'),
      }
    })

    return this.#fieldsCache
  }

  async describeColumns(): Promise<Column[]> {
    const fields = await this.fetchFields()

    return fields.map((field) => ({
      type: 'string' as Column['type'],
      name: field.name,
    }))
  }

  async doSelect(columns: string[], where?: WhereStatement) {
    const fields = await this.fetchFields()
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(
        `https://${this.#domain}.zendesk.com/api/v2/tickets/${
          properties['id']
        }.json`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const { ticket } = await response.json()

      return [
        {
          row: {
            id: ticket.id,
            ...columns.reduce(
              (acc, col) => ({ ...acc, [col]: ticket[col] }),
              {}
            ),
          },
        },
      ]
    }

    const url = new URL(
      `https://${this.#domain}.zendesk.com/api/v2/tickets.json`
    )

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { tickets } = (await response.json()) as {
      tickets: {
        id: number
        subject: string
        description: string
        status: string
        custom_fields: { id: number; value: string }[]
      }[]
    }

    return tickets.map(({ custom_fields, ...rest }) => ({
      row: {
        ...custom_fields.reduce((acc, { id, value }) => {
          const field = fields.find((f) => f.id === id.toString())

          if (!field) {
            return acc
          }

          return { ...acc, [field.name]: value }
        }, {}),
        ...rest,
        id: String(rest.id),
      },
    }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL(
      `https://${this.#domain}.zendesk.com/api/v2/tickets.json`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket: parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { ticket } = await response.json()

    return { id: ticket.id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(
      `https://${this.#domain}.zendesk.com/api/v2/tickets/${row.id}.json`
    )

    const response = await call(url.href, {
      method: 'PUT',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket: parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(
      `https://${this.#domain}.zendesk.com/api/v2/tickets/${row.id}.json`
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

export default handler(
  schema,
  [
    {
      database: 'zendesk',
      name: 'ticket',
    },
  ],
  async (table, parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const { domain } = parameters
    const tableName = getTableName(table)

    if (table.database === 'zendesk' && table.name === 'ticket') {
      return new ZendeskTicketDriver({ token, domain })
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
