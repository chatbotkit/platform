'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/space/list'

const SPACE_LIST_QUERY = `
  query ResourceListSpaces(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $contactIds: [ID!]
    $blueprintIds: [ID!]
  ) {
    spaces(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      contactIds: $contactIds
      blueprintIds: $blueprintIds
    ) {
      edges {
        node {
          id
          alias
          blueprintId
          contactId
          name
          description
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

export default function SpaceList({
  kind = 'space',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/space/export',

  deleteRoute = '/api/v1/space/[id]/delete',

  instanceRoute = '/spaces/[id]',

  filter = false,

  nameMapper: _nameMapper,
  descriptionMapper: _descriptionMapper,

  contactId,

  autoLoad,
  loading,

  ...props
}) {
  const { hydrated, scope } = useProjectScope()

  const variables = useMemo(
    () => ({
      contactIds: contactId ? [contactId] : undefined,
      blueprintIds: scope ? [scope.id] : undefined,
    }),
    [contactId, scope]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: SPACE_LIST_QUERY,
    connection: 'spaces',
    variables,
  })

  const listRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/space/list`
    }

    return _listRoute
  }, [_listRoute, contactId])

  const scopedListRoute = scopeListRoute(listRoute, scope)

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute
    ? graphqlListRoute
    : scopedListRoute

  const key = useGraphQLListRoute
    ? `graphql:${contactId || 'all-contacts'}:${scope?.id || 'all'}`
    : typeof scopedListRoute === 'string'
      ? scopedListRoute
      : undefined

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

        return <span className="italic">A space without description</span>
      })
    )
  }, [_descriptionMapper])

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
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
