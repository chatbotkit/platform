'use client'

import { useCallback, useMemo } from 'react'

import fetch from '@/lib/fetch'

function getPathValue(object, path) {
  if (typeof path === 'function') {
    return path(object)
  }

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], object)
}

function getNextCursor(connection) {
  const pageInfo = connection?.pageInfo

  if (!pageInfo) {
    return null
  }

  return pageInfo.hasNextPage ? pageInfo.endCursor || null : null
}

export default function useGraphQLConnectionListRoute({
  query,
  connection,
  variables,
  mapNode,
}) {
  const listRoute = useCallback(
    async ({ cursor, take = 100, order = 'desc' } = {}) => {
      const pagination = {
        first: take,
        after: cursor || null,
        last: null,
        before: null,
      }

      const response = await fetch('/api/v1/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          query,
          variables: {
            ...variables,
            order,
            ...pagination,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'GraphQL request failed')
      }

      if (data?.errors?.length) {
        throw new Error(data.errors[0]?.message || 'GraphQL request failed')
      }

      const payload = data?.data
      const result = getPathValue(payload, connection)
      const edges = Array.isArray(result?.edges) ? result.edges : []

      return {
        items: edges
          .map((edge) => edge?.node)
          .filter(Boolean)
          .map((node) => (typeof mapNode === 'function' ? mapNode(node) : node)),
        cursor: getNextCursor(result),
      }
    },
    [connection, mapNode, query, variables]
  )

  return useMemo(() => {
    listRoute.toJSON = () => '/api/v1/graphql'

    return listRoute
  }, [listRoute])
}
