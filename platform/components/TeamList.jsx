'use client'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'

const DEFAULT_LIST_ROUTE = '/api/v1/team/list'

const TEAM_LIST_QUERY = `
  query ResourceListTeams(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    teams(
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

export default function TeamList({
  kind = 'team',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/team/export',

  deleteRoute = '/api/v1/team/[id]/delete',

  instanceRoute = '/teams/[id]',

  filter = false,

  ...props
}) {
  const extraTags = (team) => {
    // @note only server prefetched items carry a member count - the list
    // omits the tag rather than showing a misleading zero
    const memberCount = team._count?.memberships

    if (memberCount == null) {
      return null
    }

    const memberText = memberCount === 1 ? '1 member' : `${memberCount} members`

    return [
      <span key="members" className="tag">
        {memberText}
      </span>,
    ]
  }

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: TEAM_LIST_QUERY,
    connection: 'teams',
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
      extraTags={extraTags}
    />
  )
}
