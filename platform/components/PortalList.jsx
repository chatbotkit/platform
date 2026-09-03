'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import { useApexHostURL, usePortalApex } from '@/hooks/useHostname'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/portal/list'

const PORTAL_LIST_QUERY = `
  query ResourceListPortals(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    portals(
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
          slug
          blueprintId
          config
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

export default function PortalList({
  kind = 'portal',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/portal/export',

  deleteRoute = '/api/v1/portal/[id]/delete',

  instanceRoute = '/portals/[id]',

  filter = false,

  extraLinks,

  autoLoad,
  loading,

  ...props
}) {
  const portalApex = usePortalApex()

  const toApexHostURL = useApexHostURL()

  const { hydrated, scope } = useProjectScope()

  const resolvedExtraLinks = useMemo(
    () =>
      extraLinks === undefined
        ? {
            Open: ({ slug }) => toApexHostURL(slug, portalApex),
          }
        : extraLinks,
    [extraLinks, portalApex, toApexHostURL]
  )

  const variables = useMemo(
    () => ({
      blueprintIds: scope ? [scope.id] : undefined,
    }),
    [scope]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: PORTAL_LIST_QUERY,
    connection: 'portals',
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
      extraLinks={resolvedExtraLinks}
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
