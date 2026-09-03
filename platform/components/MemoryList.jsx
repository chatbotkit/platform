'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'

const DEFAULT_LIST_ROUTE = '/api/v1/memory/list'

const MEMORY_LIST_QUERY = `
  query ResourceListMemories(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $contactIds: [ID!]
    $botIds: [ID!]
  ) {
    memories(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      contactIds: $contactIds
      botIds: $botIds
    ) {
      edges {
        node {
          id
          name
          description
          text
          contactId
          botId
          expiresAt
          meta
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

export default function MemoryList({
  kind = 'memory',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = '/api/v1/memory/export',

  deleteRoute = '/api/v1/memory/[id]/delete',

  instanceRoute = '/memories/[id]',

  filter = false,

  nameMapper: _nameMapper,
  descriptionMapper: _descriptionMapper,
  extraTags: _extraTags,

  contactId,
  botId,

  ...props
}) {
  const variables = useMemo(
    () => ({
      contactIds: contactId ? [contactId] : undefined,
      botIds: botId ? [botId] : undefined,
    }),
    [botId, contactId]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: MEMORY_LIST_QUERY,
    connection: 'memories',
    variables,
  })

  const listRoute = useMemo(() => {
    if (!contactId && !botId) {
      return _listRoute
    }

    let route = _listRoute

    const searchParams = new URLSearchParams()

    if (contactId) {
      searchParams.append('contactId', contactId)
    }

    if (botId) {
      searchParams.append('botId', botId)
    }

    if (searchParams.toString()) {
      route += '?' + searchParams.toString()
    }

    return route
  }, [_listRoute, contactId, botId])

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute ? graphqlListRoute : listRoute

  const key = useGraphQLListRoute
    ? `graphql:${contactId || 'all-contacts'}:${botId || 'all-bots'}`
    : listRoute

  const nameMapper = useMemo(() => {
    return (
      _nameMapper ||
      ((item) => {
        if (item.name) {
          return item.name
        }

        return item.id
      })
    )
  }, [_nameMapper])

  const descriptionMapper = useMemo(() => {
    return (
      _descriptionMapper ||
      ((item) => {
        if (item.description) {
          return item.description
        }

        if (item.text) {
          return item.text
        }

        return <span className="italic">A memory without description</span>
      })
    )
  }, [_descriptionMapper])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      ((item) => {
        return (
          <>
            {item.contactId ? <span className="tag">contact</span> : null}
            {item.botId ? <span className="tag">bot</span> : null}
          </>
        )
      })
    )
  }, [_extraTags])

  return (
    <ResourceList
      key={key}
      {...props}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      nameMapper={nameMapper}
      descriptionMapper={descriptionMapper}
      extraTags={extraTags}
    />
  )
}
