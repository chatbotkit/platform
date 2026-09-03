import type { fetch as chatbotkitFetch } from '@chatbotkit-dev/fetch'

import type {
  Column,
  WhereStatement} from '@chatbotkit-dev/sql';
import {
  GenericDriver,
  getWhereProperties,
} from '@chatbotkit-dev/sql'
import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils'

import { getClient } from './client'
import {
  convertDatabaseCreateProperties,
  convertDatabaseItemFilter,
  convertDatabaseUpdateProperties,
  getSimplifiedDatabaseProperties,
  introspectDatabaseProperties,
} from './database'
import { UnsupportedPropertiesError } from './errors'
import { getSimplifiedPageProperties } from './page'

type DatabaseRow = Record<string, unknown>

export class DatabaseDriver extends GenericDriver<DatabaseRow> {
  #token: TrimmedNonEmptyString
  #databaseId: TrimmedNonEmptyString
  fetch?: typeof chatbotkitFetch

  constructor({
    token,
    databaseId,
    fetch,
  }: {
    token: TrimmedNonEmptyString
    databaseId: TrimmedNonEmptyString
    fetch?: typeof chatbotkitFetch
  }) {
    super()

    this.#token = token
    this.#databaseId = databaseId
    this.fetch = fetch
  }

  async describeColumns(): Promise<Column[]> {
    const properties = await introspectDatabaseProperties({
      auth: this.#token,
      databaseId: this.#databaseId,
    })

    return [
      {
        name: 'id',
        type: 'string',
      },

      ...Object.entries(properties).map(
        ([name, { type, ['enum']: options }]) => {
          return {
            name,
            type,
            options,
          }
        }
      ),
    ]
  }

  async doSelect(columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    const client = getClient(this.#token, { fetch: this.fetch })

    if ('id' in properties) {
      const data = await client.pages.retrieve({
        page_id: properties.id as string,
      })

      // @todo validate against this.#databaseId

      return [
        {
          row: {
            id: data.id,
            ...('properties' in data
              ? getSimplifiedPageProperties(data.properties)
              : {}),
          },

          url: 'url' in data ? data.url : undefined,
        },
      ]
    } else {
      const { unsupported, filter } = await convertDatabaseItemFilter({
        auth: this.#token,
        databaseId: this.#databaseId,
        query: properties,
      })

      if (unsupported.length > 0) {
        throw new UnsupportedPropertiesError(unsupported)
      }

      const data = await client.databases.query({
        database_id: this.#databaseId,
        filter: filter,
      })

      const { results } = data

      return results.map((result) => {
        switch (result.object) {
          case 'page': {
            return {
              row: {
                id: result.id,
                ...('properties' in result
                  ? getSimplifiedPageProperties(result.properties)
                  : {}),
              },

              url: 'url' in result ? result.url : undefined,
            }
          }

          case 'database': {
            return {
              row: {
                id: result.id,
                ...('properties' in result
                  ? getSimplifiedDatabaseProperties(result.properties)
                  : {}),
              },

              url: 'url' in result ? result.url : undefined,
            }
          }

          default: {
            const x: never = result

            x

            throw new Error(`Unsupported property type`)
          }
        }
      })
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const client = getClient(this.#token, { fetch: this.fetch })

    const {
      unsupported: unsupportedProperties,
      properties: databaseProperties,
    } = await convertDatabaseCreateProperties({
      auth: this.#token,
      databaseId: this.#databaseId,
      properties: parameters,
    })

    if (unsupportedProperties.length > 0) {
      throw new UnsupportedPropertiesError(unsupportedProperties)
    }

    await client.pages.create({
      parent: {
        database_id: this.#databaseId,
      },
      properties: databaseProperties,
    })
  }

  async doUpdate(
    { row }: { row: DatabaseRow },
    parameters: Record<string, unknown>
  ) {
    const pageId = row.id as string

    if (!pageId) {
      throw new Error('Cannot update row: missing id')
    }

    const client = getClient(this.#token, { fetch: this.fetch })

    const {
      unsupported: unsupportedProperties,
      properties: databaseProperties,
    } = await convertDatabaseUpdateProperties({
      auth: this.#token,
      databaseId: this.#databaseId,
      properties: parameters,
    })

    if (unsupportedProperties.length > 0) {
      throw new UnsupportedPropertiesError(unsupportedProperties)
    }

    await client.pages.update({
      page_id: pageId,
      properties: databaseProperties,
    })
  }

  async doDelete({ row }: { row: DatabaseRow }) {
    const pageId = row.id as string

    if (!pageId) {
      throw new Error('Cannot delete row: missing id')
    }

    const client = getClient(this.#token, { fetch: this.fetch })

    await client.pages.update({
      page_id: pageId,
      archived: true,
    })
  }
}
