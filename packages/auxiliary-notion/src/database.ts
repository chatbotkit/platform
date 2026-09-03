import type { fetch as chatbotkitFetch } from '@chatbotkit-dev/fetch'

import type { Immutable } from '@chatbotkit-dev/typescript-utils/object'
import type { ToReadonlyRecord } from '@chatbotkit-dev/typescript-utils/record'
import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { getClient } from './client'

import type {
  CreatePageParameters,
  DatabaseObjectResponse,
  QueryDatabaseParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints'

export type DatabaseProperties = DatabaseObjectResponse['properties']

export type SimplifiedDatabaseProperties = Record<string, unknown>

export function getSimplifiedDatabaseProperties(
  properties: Immutable<DatabaseProperties>
): SimplifiedDatabaseProperties {
  const simplified: SimplifiedDatabaseProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (
      value.type === 'unique_id' ||
      value.type === 'formula' ||
      value.type === 'rollup' ||
      value.type === 'relation' ||
      value.type === 'people' ||
      value.type === 'files' ||
      value.type === 'created_by' ||
      value.type === 'last_edited_by'
    ) {
      continue
    }

    switch (value.type) {
      case 'title': {
        simplified[key] = value.name || null

        break
      }

      case 'status': {
        simplified[key] = value.name || null

        break
      }

      case 'rich_text': {
        simplified[key] = value.name || null

        break
      }

      case 'number': {
        simplified[key] = value.number

        break
      }

      case 'checkbox': {
        simplified[key] = value.checkbox

        break
      }

      case 'select': {
        simplified[key] = value.select.options.map(
          (item: { name: string }) => item.name
        )

        break
      }

      case 'multi_select': {
        simplified[key] = value.multi_select.options.map(
          (item: { name: string }) => item.name
        )

        break
      }

      case 'date': {
        if (value.date) {
          simplified[key] = value.date.start
        } else {
          simplified[key] = null
        }

        break
      }

      case 'url': {
        simplified[key] = value.url || null

        break
      }

      case 'email': {
        simplified[key] = value.email || null

        break
      }

      case 'phone_number': {
        simplified[key] = value.phone_number || null

        break
      }

      case 'created_time': {
        simplified[key] = value.created_time

        break
      }

      case 'last_edited_time': {
        simplified[key] = value.last_edited_time

        break
      }

      default: {
        const x: never = value

        x
      }
    }
  }

  return simplified
}

export interface IntrospectedDatabaseProperty {
  format: Exclude<
    DatabaseProperties[string]['type'],
    | 'unique_id'
    | 'formula'
    | 'rollup'
    | 'relation'
    | 'people'
    | 'files'
    | 'created_by'
    | 'last_edited_by'
  >
  type: 'string' | 'number' | 'boolean'
  enum?: string[]
  description?: string
}

export async function introspectDatabaseProperties({
  auth,
  databaseId,
  fetch,
}: {
  auth: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  fetch?: typeof chatbotkitFetch
}): Promise<Record<string, IntrospectedDatabaseProperty>> {
  const client = getClient(auth, { fetch })

  const data = await client.databases.retrieve({
    database_id: databaseId,
  })

  const properties: Record<string, IntrospectedDatabaseProperty> = {}

  for (const [name, value] of Object.entries(data.properties)) {
    if (
      value.type === 'unique_id' ||
      value.type === 'formula' ||
      value.type === 'rollup' ||
      value.type === 'relation' ||
      value.type === 'people' ||
      value.type === 'files' ||
      value.type === 'created_by' ||
      value.type === 'last_edited_by'
    ) {
      continue
    }

    switch (value.type) {
      case 'title': {
        properties[name] = {
          format: 'title',
          type: 'string',
        }

        break
      }

      case 'status': {
        properties[name] = {
          format: 'status',
          type: 'string',
          enum: value.status.options.map((option) => option.name),
        }

        break
      }

      case 'rich_text': {
        properties[name] = {
          format: 'rich_text',
          type: 'string',
        }

        break
      }

      case 'number': {
        properties[name] = {
          format: 'number',
          type: 'number',
        }

        break
      }

      case 'checkbox': {
        properties[name] = {
          format: 'checkbox',
          type: 'boolean',
        }

        break
      }

      case 'select': {
        properties[name] = {
          format: 'select',
          type: 'string',
          enum: value.select.options.map((option) => option.name),
        }

        break
      }

      case 'multi_select': {
        properties[name] = {
          format: 'multi_select',
          type: 'string',
          description: 'Comma-separated values',
        }

        break
      }

      case 'date': {
        properties[name] = {
          format: 'date',
          type: 'string',
          description: 'Date in ISO 8601 format',
        }

        break
      }

      case 'url': {
        properties[name] = {
          format: 'url',
          type: 'string',
          description: 'Valid URL',
        }

        break
      }

      case 'email': {
        properties[name] = {
          format: 'email',
          type: 'string',
          description: 'Valid email address',
        }

        break
      }

      case 'phone_number': {
        properties[name] = {
          format: 'phone_number',
          type: 'string',
          description: 'Valid phone number',
        }

        break
      }

      case 'created_time': {
        properties[name] = {
          format: 'created_time',
          type: 'string',
          description: 'Creation time in ISO 8601 format',
        }

        break
      }

      case 'last_edited_time': {
        properties[name] = {
          format: 'last_edited_time',
          type: 'string',
          description: 'Last edited time in ISO 8601 format',
        }

        break
      }

      default: {
        const x: never = value

        x
      }
    }
  }

  return properties
}

export function getMultiSelectUpsertValues(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((item) => typeof item === 'string' || item instanceof String)
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof input === 'string' || input instanceof String) {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export type DatabaseCreateItemProperties = CreatePageParameters['properties']

export function convertDatabaseCreatePropertiesFromKnownProperties({
  knownDatabaseProperties,
  properties,
}: {
  knownDatabaseProperties: ToReadonlyRecord<
    Record<string, IntrospectedDatabaseProperty>
  >
  properties: ToReadonlyRecord<Record<string, unknown>>
}): {
  unsupported: string[]
  properties: DatabaseCreateItemProperties
} {
  const databaseProperties: DatabaseCreateItemProperties = {}

  const unsupportedProperties: string[] = Object.keys(properties).filter(
    (key) => !(key in knownDatabaseProperties)
  )

  for (const [key, value] of Object.entries(knownDatabaseProperties)) {
    if (!(key in properties)) {
      continue
    }

    if (
      value.format === 'created_time' ||
      value.format === 'last_edited_time'
    ) {
      continue
    }

    switch (value.format) {
      case 'title': {
        // @note Notion API limits rich_text content to 2000 characters per block
        databaseProperties[key] = {
          title: [
            {
              type: 'text',
              text: {
                content: String(properties[key]).slice(0, 2000),
              },
            },
          ],
        }

        break
      }

      case 'status': {
        databaseProperties[key] = {
          status: {
            name: String(properties[key]),
          },
        }

        break
      }

      case 'rich_text': {
        // @note Notion API limits rich_text content to 2000 characters per block
        databaseProperties[key] = {
          rich_text: [
            {
              type: 'text',
              text: {
                content: String(properties[key]).slice(0, 2000),
              },
            },
          ],
        }

        break
      }

      case 'number': {
        databaseProperties[key] = {
          number: parseFloat(String(properties[key])),
        }

        break
      }

      case 'checkbox': {
        databaseProperties[key] = {
          checkbox: Boolean(properties[key]),
        }

        break
      }

      case 'select': {
        databaseProperties[key] = {
          select: {
            name: String(properties[key]),
          },
        }

        break
      }

      case 'multi_select': {
        const values = getMultiSelectUpsertValues(properties[key])

        if (values.length > 0) {
          databaseProperties[key] = {
            multi_select: values.map((item) => ({
              name: item,
            })),
          }
        }

        break
      }

      case 'date': {
        databaseProperties[key] = {
          date: {
            start: String(properties[key]),
          },
        }

        break
      }

      case 'url': {
        const urlValue = String(properties[key])

        databaseProperties[key] = {
          url: urlValue.trim() === '' ? null : urlValue,
        }

        break
      }

      case 'email': {
        const emailValue = String(properties[key])

        databaseProperties[key] = {
          email: emailValue.trim() === '' ? null : emailValue,
        }

        break
      }

      case 'phone_number': {
        const phoneValue = String(properties[key])

        databaseProperties[key] = {
          phone_number: phoneValue.trim() === '' ? null : phoneValue,
        }

        break
      }

      default: {
        const x: never = value.format

        x
      }
    }
  }

  return {
    unsupported: unsupportedProperties,
    properties: databaseProperties,
  }
}

export async function convertDatabaseCreateProperties({
  auth,
  databaseId,
  properties,
}: {
  auth: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  properties: ToReadonlyRecord<Record<string, unknown>>
}): Promise<{
  unsupported: string[]
  properties: DatabaseCreateItemProperties
}> {
  const knownDatabaseProperties = await introspectDatabaseProperties({
    auth,
    databaseId,
  })

  return convertDatabaseCreatePropertiesFromKnownProperties({
    knownDatabaseProperties,
    properties,
  })
}

export type DatabaseUpdateItemProperties = UpdatePageParameters['properties']

export function convertDatabaseUpdatePropertiesFromKnownProperties({
  knownDatabaseProperties,
  properties,
}: {
  knownDatabaseProperties: ToReadonlyRecord<
    Record<string, IntrospectedDatabaseProperty>
  >
  properties: ToReadonlyRecord<Record<string, unknown>>
}): {
  unsupported: string[]
  properties: DatabaseUpdateItemProperties
} {
  return convertDatabaseCreatePropertiesFromKnownProperties({
    knownDatabaseProperties,
    properties,
  })
}

export async function convertDatabaseUpdateProperties({
  auth,
  databaseId,
  properties,
}: {
  auth: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  properties: ToReadonlyRecord<Record<string, unknown>>
}): Promise<{
  unsupported: string[]
  properties: DatabaseUpdateItemProperties
}> {
  const {
    unsupported: unsupportedProperties,
    properties: convertedProperties,
  } = await convertDatabaseCreateProperties({
    auth,
    databaseId,
    properties,
  })

  return {
    unsupported: unsupportedProperties,
    properties: convertedProperties,
  }
}

export type DatabaseItemFilter = QueryDatabaseParameters['filter']

export function convertDatabaseItemFilterFromKnownProperties({
  knownDatabaseProperties,
  query,
}: {
  knownDatabaseProperties: ToReadonlyRecord<
    Record<string, IntrospectedDatabaseProperty>
  >
  query: ToReadonlyRecord<Record<string, string>>
}): { unsupported: string[]; filter: DatabaseItemFilter | undefined } {
  const filter: DatabaseItemFilter = {
    or: [],
  }

  const unsupported: string[] = Object.keys(query).filter(
    (key) => !(key in knownDatabaseProperties)
  )

  for (const [key, value] of Object.entries(knownDatabaseProperties)) {
    if (!(key in query)) {
      continue
    }

    if (
      value.format === 'created_time' ||
      value.format === 'last_edited_time'
    ) {
      continue
    }

    switch (value.format) {
      case 'title': {
        filter.or.push({
          property: key,
          title: {
            contains: String(query[key]),
          },
        })

        break
      }

      case 'status': {
        filter.or.push({
          property: key,
          status: {
            equals: String(query[key]),
          },
        })

        break
      }

      case 'rich_text': {
        filter.or.push({
          property: key,
          rich_text: {
            contains: String(query[key]),
          },
        })

        break
      }

      case 'number': {
        filter.or.push({
          property: key,
          number: {
            equals: parseFloat(String(query[key])),
          },
        })

        break
      }

      case 'checkbox': {
        filter.or.push({
          property: key,
          checkbox: {
            equals: Boolean(query[key]),
          },
        })

        break
      }

      case 'select': {
        filter.or.push({
          property: key,
          select: {
            equals: String(query[key]),
          },
        })

        break
      }

      case 'multi_select': {
        filter.or.push({
          property: key,
          multi_select: {
            contains: String(query[key]),
          },
        })

        break
      }

      case 'date': {
        filter.or.push({
          property: key,
          date: {
            equals: String(query[key]),
          },
        })

        break
      }

      case 'url': {
        filter.or.push({
          property: key,
          url: {
            equals: String(query[key]),
          },
        })

        break
      }

      case 'email': {
        filter.or.push({
          property: key,
          email: {
            equals: String(query[key]),
          },
        })

        break
      }

      case 'phone_number': {
        filter.or.push({
          property: key,
          phone_number: {
            equals: String(query[key]),
          },
        })

        break
      }

      default: {
        const x: never = value.format

        x
      }
    }
  }

  return {
    unsupported: unsupported,
    filter: filter.or.length > 0 ? filter : undefined,
  }
}

export async function convertDatabaseItemFilter({
  auth,
  databaseId,
  query,
}: {
  auth: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  query: ToReadonlyRecord<Record<string, string>>
}): Promise<{ unsupported: string[]; filter: DatabaseItemFilter | undefined }> {
  const knownDatabaseProperties = await introspectDatabaseProperties({
    auth,
    databaseId,
  })

  return convertDatabaseItemFilterFromKnownProperties({
    knownDatabaseProperties,
    query,
  })
}
