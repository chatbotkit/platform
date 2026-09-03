'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'

const DEFAULT_LIST_ROUTE = '/api/v1/contact/list'

const CONTACT_LIST_QUERY = `
  query ResourceListContacts(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    contacts(
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
          fingerprint
          email
          phone
          nick
          verifiedAt
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

export default function ContactList({
  kind = 'contact',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = '/api/v1/contact/export',

  deleteRoute = '/api/v1/contact/[id]/delete',

  instanceRoute = '/contacts/[id]',

  filter = true,

  extraTags: _extraTags,

  ...props
}) {
  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: CONTACT_LIST_QUERY,
    connection: 'contacts',
  })

  const effectiveListRoute =
    listMode === 'graphql' && listRoute === DEFAULT_LIST_ROUTE
      ? graphqlListRoute
      : listRoute

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ verifiedAt }) => {
        return (
          <>
            <div className="tag">{verifiedAt ? 'verified' : 'unverified'}</div>
          </>
        )
      })
    )
  }, [_extraTags])

  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      extraTags={extraTags}
    />
  )
}
