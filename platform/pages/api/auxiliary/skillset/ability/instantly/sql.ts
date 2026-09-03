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
})

interface Row {
  id: string
}

class InstantlyCampaignDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'name' },
      { type: 'number', name: 'status' },
      { type: 'number', name: 'daily_limit' },
      { type: 'string', name: 'timestamp_created', readOnly: true },
      { type: 'string', name: 'timestamp_updated', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(
        `https://api.instantly.ai/api/v2/campaigns/${properties['id']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    } else {
      const url = new URL('https://api.instantly.ai/api/v2/campaigns')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return result.items.map((campaign) => ({ row: campaign }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.instantly.ai/api/v2/campaigns')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    return { id: result.id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(`https://api.instantly.ai/api/v2/campaigns/${row.id}`)

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(`https://api.instantly.ai/api/v2/campaigns/${row.id}`)

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

class InstantlyLeadDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'name' },
      { type: 'string', name: 'email' },
      { type: 'string', name: 'website' },
      { type: 'string', name: 'first_name' },
      { type: 'string', name: 'last_name' },
      { type: 'string', name: 'company_name' },
      { type: 'string', name: 'status' },
      { type: 'string', name: 'status_summary', readOnly: true },
      { type: 'string', name: 'campaign' },
      { type: 'string', name: 'list_id' },
      { type: 'string', name: 'timestamp_created', readOnly: true },
      { type: 'string', name: 'timestamp_updated', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(
        `https://api.instantly.ai/api/v2/leads/${properties['id']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    } else {
      const url = new URL('https://api.instantly.ai/api/v2/leads/list')

      const response = await call(url.href, {
        method: 'POST',
        headers: {
          Authorization: this.#token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(properties['campaign']
            ? { campaign: properties['campaign'] }
            : {}),
          ...(properties['list_id'] ? { list_id: properties['list_id'] } : {}),
        }),
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return result.items.map((lead) => ({ row: lead }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.instantly.ai/api/v2/leads')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    return { id: result.id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(`https://api.instantly.ai/api/v2/leads/${row.id}`)

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(`https://api.instantly.ai/api/v2/leads/${row.id}`)

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

class InstantlyEmailDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'name' },
      { type: 'string', name: 'email' },
      { type: 'string', name: 'phone' },
      { type: 'string', name: 'timestamp_created', readOnly: true },
      { type: 'string', name: 'timestamp_updated', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(
        `https://api.instantly.ai/api/v2/emails/${properties['id']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    } else {
      const url = new URL('https://api.instantly.ai/api/v2/emails')

      const response = await call(url.href, {
        method: 'POST',
        headers: {
          Authorization: this.#token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return result.items.map((email) => ({ row: email }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.instantly.ai/api/v2/emails')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    return { id: result.id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const url = new URL(`https://api.instantly.ai/api/v2/emails/${row.id}`)

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...parameters,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(`https://api.instantly.ai/api/v2/emails/${row.id}`)

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
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
      database: 'instantly',
      name: 'campaigns',
    },
    {
      database: 'instantly',
      name: 'leads',
    },
    {
      database: 'instantly',
      name: 'emails',
    },
  ],
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const tableName = getTableName(table)

    switch (tableName) {
      case 'instantly.campaigns': {
        return new InstantlyCampaignDriver({ token })
      }

      case 'instantly.leads': {
        return new InstantlyLeadDriver({ token })
      }

      case 'instantly.emails': {
        return new InstantlyEmailDriver({ token })
      }
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
