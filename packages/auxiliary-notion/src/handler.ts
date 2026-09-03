import type { fetch as chatbotkitFetch } from '@chatbotkit-dev/fetch'

import type { PositiveNumber } from '@chatbotkit-dev/typescript-utils/number'
import type { ToReadonlyRecord } from '@chatbotkit-dev/typescript-utils/record'
import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { getClient } from './client'
import { getContents } from './contents'
import type {
  DatabaseProperties,
  IntrospectedDatabaseProperty,
  SimplifiedDatabaseProperties,
} from './database'
import {
  convertDatabaseCreateProperties,
  convertDatabaseItemFilter,
  convertDatabaseUpdateProperties,
  getSimplifiedDatabaseProperties,
  introspectDatabaseProperties,
} from './database'
import { UnsupportedPropertiesError } from './errors'
import type { PageProperties, SimplifiedPageProperties } from './page'
import { getSimplifiedPageProperties } from './page'

export type PageEnumerationItem = {
  id: string
  object: 'page'
  parent?: object
  created_time?: string
  last_edited_time?: string
  properties:
    | ReturnType<typeof getSimplifiedPageProperties>
    | Record<string, unknown>
  url?: string
}

export type DatabaseEnumerationItem = {
  id: string
  object: 'database'
  parent?: object
  title?: string
  created_time?: string
  last_edited_time?: string
  properties:
    | ReturnType<typeof getSimplifiedDatabaseProperties>
    | Record<string, unknown>
  url?: string
}

export type EnumerationItem = PageEnumerationItem | DatabaseEnumerationItem

export async function searchHandler({
  token,
  query,
  startCursor: _startCursor,
  pageSize: _pageSize,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  query?: TrimmedNonEmptyString
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  items: EnumerationItem[]
  cursor: string | undefined
}> {
  const client = getClient(token, { fetch })

  let startCursor = _startCursor ? _startCursor.trim() : undefined

  startCursor = startCursor && startCursor.length > 0 ? startCursor : undefined

  let pageSize = _pageSize ? _pageSize : 20

  pageSize = Math.min(pageSize, 100)

  const data = await client.search({
    query: query,
    start_cursor: startCursor,
    page_size: pageSize,
  })

  const { results } = data

  const items: EnumerationItem[] = []

  for (const item of results) {
    switch (item.object) {
      case 'page': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        items.push({
          id,

          object,

          parent,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedPageProperties(properties)
            : properties,

          url,
        })

        break
      }

      case 'database': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const title =
          'title' in item
            ? item.title.map(({ plain_text }) => plain_text).join(' ')
            : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        items.push({
          id,

          object,

          parent,

          title,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedDatabaseProperties(properties)
            : properties,

          url,
        })

        break
      }

      default: {
        const x: never = item

        x
      }
    }
  }

  return {
    items,
    cursor: data.next_cursor ? data.next_cursor : undefined,
  }
}

export async function listHandler({
  token,
  startCursor,
  pageSize,
  simplifiedProperties,
}: {
  token: TrimmedNonEmptyString
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
}): Promise<{
  items: EnumerationItem[]
  cursor: string | undefined
}> {
  return await searchHandler({
    token,
    startCursor,
    pageSize,
    simplifiedProperties,
  })
}

export async function listPagesHandler({
  token,
  startCursor: _startCursor,
  pageSize: _pageSize,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  pages: PageEnumerationItem[]
  cursor: string | undefined
}> {
  const client = getClient(token, { fetch })

  let startCursor = _startCursor ? _startCursor.trim() : undefined

  startCursor = startCursor && startCursor.length > 0 ? startCursor : undefined

  let pageSize = _pageSize ? _pageSize : 20

  pageSize = Math.min(pageSize, 100)

  const data = await client.search({
    filter: {
      property: 'object',
      value: 'page',
    },
    start_cursor: startCursor,
    page_size: pageSize,
  })

  const { results } = data

  const pages: PageEnumerationItem[] = []

  for (const item of results) {
    switch (item.object) {
      case 'page': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        pages.push({
          id,

          object,

          parent,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedPageProperties(properties)
            : properties,

          url,
        })

        break
      }

      case 'database': {
        break
      }

      default: {
        const x: never = item

        x
      }
    }
  }

  return {
    pages,
    cursor: data.next_cursor ? data.next_cursor : undefined,
  }
}

export async function listDatabasesHandler({
  token,
  startCursor: _startCursor,
  pageSize: _pageSize,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  databases: DatabaseEnumerationItem[]
  cursor: string | undefined
}> {
  const client = getClient(token, { fetch })

  let startCursor = _startCursor ? _startCursor.trim() : undefined

  startCursor = startCursor && startCursor.length > 0 ? startCursor : undefined

  let pageSize = _pageSize ? _pageSize : 20

  pageSize = Math.min(pageSize, 100)

  const data = await client.search({
    filter: {
      property: 'object',
      value: 'database',
    },
    start_cursor: startCursor,
    page_size: pageSize,
  })

  const { results } = data

  const databases: DatabaseEnumerationItem[] = []

  for (const item of results) {
    switch (item.object) {
      case 'page': {
        break
      }

      case 'database': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const title =
          'title' in item
            ? item.title.map(({ plain_text }) => plain_text).join(' ')
            : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        databases.push({
          id,

          object,

          parent,

          title,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedDatabaseProperties(properties)
            : properties,

          url,
        })

        break
      }

      default: {
        const x: never = item

        x
      }
    }
  }

  return {
    databases,
    cursor: data.next_cursor ? data.next_cursor : undefined,
  }
}

export async function fetchPageHandler({
  token,
  pageId,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  pageId: TrimmedNonEmptyString
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  page: {
    id: string

    object: 'page'

    created_time?: string
    last_edited_time?: string

    properties: SimplifiedPageProperties | PageProperties

    url?: string
  }
  contents: string
}> {
  const client = getClient(token, { fetch })

  const page = await client.pages.retrieve({
    page_id: pageId,
  })

  const id = page.id

  const object = page.object

  const created_time = 'created_time' in page ? page.created_time : undefined
  const last_edited_time =
    'last_edited_time' in page ? page.last_edited_time : undefined

  const properties = 'properties' in page ? page.properties : {}

  const url = 'url' in page ? page.url : undefined

  const contents = await getContents({ auth: token, pageId })

  return {
    page: {
      id,

      object,

      created_time,
      last_edited_time,

      properties: simplifiedProperties
        ? getSimplifiedPageProperties(properties)
        : properties,

      url,
    },
    contents,
  }
}

export async function introspectDatabaseHandler({
  token,
  databaseId,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  fetch?: typeof chatbotkitFetch
}): Promise<Record<string, IntrospectedDatabaseProperty>> {
  return await introspectDatabaseProperties({ auth: token, databaseId, fetch })
}

export async function searchDatabaseHandler({
  token,
  databaseId,
  query,
  startCursor: _startCursor,
  pageSize: _pageSize,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  query?: ToReadonlyRecord<Record<string, string>>
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  items: EnumerationItem[]
  cursor: string | undefined
}> {
  const client = getClient(token, { fetch })

  let filter

  {
    if (query) {
      const { unsupported, filter: _filter } = await convertDatabaseItemFilter({
        auth: token,
        databaseId,
        query,
      })

      if (unsupported.length > 0) {
        throw new UnsupportedPropertiesError(unsupported)
      }

      filter = _filter
    } else {
      filter = undefined
    }
  }

  let startCursor = _startCursor ? _startCursor.trim() : undefined

  startCursor = startCursor && startCursor.length > 0 ? startCursor : undefined

  let pageSize = _pageSize ? _pageSize : 20

  pageSize = Math.min(pageSize, 100)

  const data = await client.databases.query({
    database_id: databaseId,
    filter: filter,
    start_cursor: startCursor,
    page_size: pageSize,
  })

  const { results } = data

  const items: EnumerationItem[] = []

  for (const item of results) {
    switch (item.object) {
      case 'page': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        items.push({
          id,

          object,

          parent,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedPageProperties(properties)
            : properties,

          url,
        })

        break
      }

      case 'database': {
        const id = item.id

        const object = item.object

        const parent = 'parent' in item ? item.parent : undefined

        const title =
          'title' in item
            ? item.title.map(({ plain_text }) => plain_text).join(' ')
            : undefined

        const created_time =
          'created_time' in item ? item.created_time : undefined
        const last_edited_time =
          'last_edited_time' in item ? item.last_edited_time : undefined

        const properties = 'properties' in item ? item.properties : {}

        const url = 'url' in item ? item.url : undefined

        items.push({
          id,

          object,

          parent,

          title,

          created_time,
          last_edited_time,

          properties: simplifiedProperties
            ? getSimplifiedDatabaseProperties(properties)
            : properties,

          url,
        })

        break
      }

      default: {
        const x: never = item

        x
      }
    }
  }

  return {
    items,
    cursor: data.next_cursor ? data.next_cursor : undefined,
  }
}

export async function listDatabaseItemsHandler({
  token,
  databaseId,
  startCursor,
  pageSize,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  startCursor?: TrimmedNonEmptyString
  pageSize?: PositiveNumber
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  items: EnumerationItem[]
  cursor: string | undefined
}> {
  return await searchDatabaseHandler({
    token,
    databaseId,
    startCursor,
    pageSize,
    simplifiedProperties,
    fetch,
  })
}

export async function fetchDatabaseItemHandler({
  token,
  databaseId,
  itemId,
  simplifiedProperties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  itemId: TrimmedNonEmptyString
  simplifiedProperties?: boolean
  fetch?: typeof chatbotkitFetch
}): Promise<{
  item: {
    id: string

    object: 'page' | 'database'

    created_time?: string
    last_edited_time?: string

    properties: SimplifiedDatabaseProperties | DatabaseProperties

    url?: string
  }
  contents: string
}> {
  databaseId // @todo validate the item belongs to the database

  const client = getClient(token, { fetch })

  const data = await client.pages.retrieve({
    page_id: itemId,
  })

  const id = data.id

  const created_time = 'created_time' in data ? data.created_time : undefined
  const last_edited_time =
    'last_edited_time' in data ? data.last_edited_time : undefined

  const properties = 'properties' in data ? data.properties : {}

  const url = 'url' in data ? data.url : undefined

  return {
    item: {
      id,

      object: data.object,

      created_time,
      last_edited_time,

      properties: simplifiedProperties
        ? getSimplifiedPageProperties(properties)
        : properties,

      url,
    },
    contents: await getContents({ auth: token, pageId: itemId }),
  }
}

export async function createDatabaseItemHandler({
  token,
  databaseId,
  properties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  properties: ToReadonlyRecord<Record<string, unknown>>
  fetch?: typeof chatbotkitFetch
}): Promise<{
  id: string
  object: 'page'
  url?: string
}> {
  const client = getClient(token, { fetch })

  const { unsupported: unsupportedProperties, properties: databaseProperties } =
    await convertDatabaseCreateProperties({
      auth: token,
      databaseId,
      properties,
    })

  if (unsupportedProperties.length > 0) {
    throw new UnsupportedPropertiesError(unsupportedProperties)
  }

  const data = await client.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties: databaseProperties,
  })

  return {
    id: data.id,

    object: data.object,

    url: 'url' in data ? data.url : undefined,
  }
}

export async function updateDatabaseItemHandler({
  token,
  databaseId,
  itemId,
  properties,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  itemId: TrimmedNonEmptyString
  properties: ToReadonlyRecord<Record<string, unknown>>
  fetch?: typeof chatbotkitFetch
}): Promise<{
  id: string
  object: 'page'
  url?: string
}> {
  const client = getClient(token, { fetch })

  const { unsupported: unsupportedProperties, properties: databaseProperties } =
    await convertDatabaseUpdateProperties({
      auth: token,
      databaseId,
      properties,
    })

  if (unsupportedProperties.length > 0) {
    throw new UnsupportedPropertiesError(unsupportedProperties)
  }

  const data = await client.pages.update({
    page_id: itemId,
    properties: databaseProperties,
  })

  return {
    id: data.id,

    object: data.object,

    url: 'url' in data ? data.url : undefined,
  }
}

export async function deleteDatabaseItemHandler({
  token,
  databaseId,
  itemId,
  fetch,
}: {
  token: TrimmedNonEmptyString
  databaseId: TrimmedNonEmptyString
  itemId: TrimmedNonEmptyString
  fetch?: typeof chatbotkitFetch
}): Promise<{
  id: string
  object: 'page'
  url?: string
}> {
  databaseId // @todo validate the item belongs to the database

  const client = getClient(token, { fetch })

  const data = await client.pages.update({
    page_id: itemId,
    archived: true,
  })

  return {
    id: data.id,

    object: data.object,

    url: 'url' in data ? data.url : undefined,
  }
}
