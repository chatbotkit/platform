import type { Column, Driver } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getWhereProperties } from '@chatbotkit-dev/sql/parse'

import { makeHandler2 } from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

interface Row {
  id: string
}

class ContactDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'email' },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(
        `https://services.leadconnectorhq.com/contacts/${properties['id']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          Version: '2021-07-28',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    } else {
      const url = new URL('https://services.leadconnectorhq.com/contacts/')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          Version: '2021-07-28',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return result.contacts.map((contact) => ({ row: contact }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    parameters

    throw new Error('Not implemented')
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    row
    parameters

    throw new Error('Not implemented')
  }

  async doDelete({ row }: { row: Row }) {
    row

    throw new Error('Not implemented')
  }
}

function makeGetDriver(DriverClass: {
  new (params: { token: string }): Driver
}) {
  return async (_parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      throwNotAuthenticated()
    }

    return new DriverClass({ token })
  }
}

export default makeHandler2(schema, [
  {
    name: 'contact',
    getDriver: makeGetDriver(ContactDriver),
  },
])
