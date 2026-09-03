'use client'

import { useMemo } from 'react'

import { shortFormat } from '@/lib/number'

import { useConfirm } from '@/components/Confirm'
import ResourceList from '@/components/ResourceList'

import useFetch from '@/hooks/useFetch'
import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useRouter from '@/hooks/useRouter'

const DEFAULT_LIST_ROUTE = '/api/v1/user/list'

const USER_LIST_QUERY = `
  query ResourceListUsers(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    users(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
    ) {
      edges {
        node {
          id
          name
          description
          image
          email
          usage
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

export default function UserList({
  kind = 'user',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null,

  deleteRoute = '/api/v1/user/[id]/delete',

  instanceRoute = '/users/[id]',

  filter = false,

  loadMore = false,

  extraLinks: _extraLinks,

  extraTags: _extraTags,

  ...props
}) {
  const router = useRouter()

  const confirm = useConfirm()

  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  const extraLinks = useMemo(() => {
    return (
      _extraLinks ||
      (({ id }) => {
        return {
          Switch: async () => {
            if (
              !(await confirm(
                'Do you really want to switch to this user?'
              ))
            ) {
              return
            }

            const { error } = await fetch(`/api/me/user/${id}/switch`, {
              data: {},
            })

            if (!error) {
              router.push(`/overview`)
            }
          },
        }
      })
    )
  }, [_extraLinks, router, confirm, fetch])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ usage }) => {
        if (!usage) {
          return null
        }

        return (
          <>
            {Object.entries(usage).map(([key, data]) => (
              <span key={key} className="tag">
                {shortFormat(data?.value ?? 0)} {key}
              </span>
            ))}
          </>
        )
      })
    )
  }, [_extraTags])

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: USER_LIST_QUERY,
    connection: 'users',
  })

  const useGraphQLListRoute =
    listMode === 'graphql' && listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute ? graphqlListRoute : listRoute

  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      loadMore={loadMore}
      extraLinks={extraLinks}
      extraTags={extraTags}
    />
  )
}
