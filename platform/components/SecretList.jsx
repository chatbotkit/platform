'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/secret/list'

const SECRET_LIST_QUERY = `
  query ResourceListSecrets(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    secrets(
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
          kind
          type
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

export default function SecretList({
  kind = 'secret',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/secret/export',

  deleteRoute: _deleteRoute = '/api/v1/secret/[id]/delete',

  deleteCaption: _deleteCaption,

  instanceRoute = '/secrets/[id]',

  filter = false,

  extraTags: _extraTags,

  contactId,

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
    query: SECRET_LIST_QUERY,
    connection: 'secrets',
    variables,
  })

  const listRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/secret/list`
    }

    return _listRoute
  }, [_listRoute, contactId])

  const scopedListRoute = scopeListRoute(listRoute, scope)

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE && !contactId

  const effectiveListRoute = useGraphQLListRoute
    ? graphqlListRoute
    : scopedListRoute

  const key = useGraphQLListRoute
    ? `graphql:${scope?.id || 'all'}`
    : typeof scopedListRoute === 'string'
      ? scopedListRoute
      : undefined

  const deleteRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/secret/[id]/delete`
    }

    return _deleteRoute
  }, [_deleteRoute, contactId])

  const deleteCaption = useMemo(() => {
    if (contactId) {
      return 'Revoke'
    }

    return _deleteCaption
  }, [_deleteCaption, contactId])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ kind, type }) => {
        return (
          <>
            {kind ? <div className="tag">{kind}</div> : null}
            {type ? <div className="tag">{type}</div> : null}
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
      deleteCaption={deleteCaption}
      instanceRoute={instanceRoute}
      filter={filter}
      extraTags={extraTags}
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
