'use client'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'

const DEFAULT_LIST_ROUTE = '/api/v1/blueprint/list'

const BLUEPRINT_LIST_QUERY = `
  query ResourceListBlueprints(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    blueprints(
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
          visibility
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

export default function BlueprintList({
  kind = 'blueprint',

  listRoute = DEFAULT_LIST_ROUTE,
  listMode = listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = null, // '/api/v1/blueprint/export',

  deleteRoute = '/api/v1/blueprint/[id]/delete',

  instanceRoute = '/blueprints/[id]',

  filter = false,

  extraLinks = {
    Design: '/blueprints/[id]/designer',
  },

  ...props
}) {
  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: BLUEPRINT_LIST_QUERY,
    connection: 'blueprints',
  })

  const effectiveListRoute =
    listMode === 'graphql' && listRoute === DEFAULT_LIST_ROUTE
      ? graphqlListRoute
      : listRoute

  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      deleteOptions={[
        {
          name: 'deleteResources',
          label: 'Also delete all associated resources',
          description:
            'Permanently delete every bot, dataset, skillset, integration, and other resource created by this blueprint. Leave unchecked to keep them as standalone items. This cannot be undone.',
          default: false,
        },
      ]}
      instanceRoute={instanceRoute}
      filter={filter}
      extraLinks={extraLinks}
    />
  )
}
