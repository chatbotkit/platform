'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/bot/list'

const BOT_LIST_QUERY = `
  query ResourceListBots(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    bots(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      blueprintIds: $blueprintIds
    ) {
      edges {
        node {
          id
          name
          description
          meta
          createdAt
          updatedAt
          blueprintId
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

export default function BotList({
  kind = 'bot',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/bot/export',

  deleteRoute = '/api/v1/bot/[id]/delete',

  instanceRoute = '/bots/[id]',

  filter = false,

  autoLoad,
  loading,

  ...props
}) {
  const { hydrated, scope } = useProjectScope()

  const variables = useMemo(
    () => ({
      blueprintIds: scope ? [scope.id] : undefined,
    }),
    [scope]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: BOT_LIST_QUERY,
    connection: 'bots',
    variables,
  })

  const scopedListRoute = scopeListRoute(listRoute, scope)

  const useGraphQLListRoute =
    listMode === 'graphql' && listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute
    ? graphqlListRoute
    : scopedListRoute

  const key = useGraphQLListRoute
    ? `graphql:${scope?.id || 'all'}`
    : typeof scopedListRoute === 'string'
      ? scopedListRoute
      : undefined

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
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
