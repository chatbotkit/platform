'use client'

import { useMemo } from 'react'

import { saveUrl } from '@/lib/save'

import ResourceList from '@/components/ResourceList'

import useFetch from '@/hooks/useFetch'
import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/file/list'

const FILE_LIST_QUERY = `
  query ResourceListFiles(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    files(
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
          blueprintId
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

export default function FileList({
  kind = 'file',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/file/export',

  deleteRoute = '/api/v1/file/[id]/delete',

  instanceRoute = '/files/[id]',

  filter = false,

  extraLinks: _extraLinks,
  extraTags: _extraTags,

  autoLoad,
  loading,

  ...props
}) {
  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  const { hydrated, scope } = useProjectScope()

  const variables = useMemo(
    () => ({
      blueprintIds: scope ? [scope.id] : undefined,
    }),
    [scope]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: FILE_LIST_QUERY,
    connection: 'files',
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

  const extraLinks = useMemo(() => {
    return (
      _extraLinks ||
      (({ id }) => {
        return {
          Download: async () => {
            const { error, data } = await fetch(`/api/v1/file/${id}/download`, {
              headers: {
                accept: 'application/json',
              },
            })

            if (error) {
              return
            }

            saveUrl(data.url)
          },
        }
      })
    )
  }, [_extraLinks, fetch])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ meta }) => {
        return (
          <>
            {meta?.contentType ? (
              <div className="tag">{meta.contentType}</div>
            ) : null}
            {meta?.app ? <div className="tag">{meta.app}</div> : null}
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
      extraLinks={extraLinks}
      extraTags={extraTags}
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
