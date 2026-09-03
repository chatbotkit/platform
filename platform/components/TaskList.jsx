'use client'

import { useMemo } from 'react'

import { timeAgo } from '@chatbotkit-dev/time'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope, { scopeListRoute } from '@/hooks/useProjectScope'

const DEFAULT_LIST_ROUTE = '/api/v1/task/list'

const TASK_LIST_QUERY = `
  query ResourceListTasks(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $contactIds: [ID!]
    $botIds: [ID!]
    $blueprintIds: [ID!]
  ) {
    tasks(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      contactIds: $contactIds
      botIds: $botIds
      blueprintIds: $blueprintIds
    ) {
      edges {
        node {
          id
          name
          description
          schedule
          timezone
          status
          outcome
          lastRunAt
          nextRunAt
          expiresAt
          blueprintId
          botId
          contactId
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

export default function TaskList({
  kind = 'task',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = '/api/v1/task/export',

  deleteRoute = '/api/v1/task/[id]/delete',

  instanceRoute = '/tasks/[id]',

  filter = true,

  extraTags: _extraTags,

  contactId,
  botId,
  blueprintId,

  autoLoad,
  loading,

  ...props
}) {
  const { hydrated, scope } = useProjectScope()

  const effectiveBlueprintId = blueprintId || scope?.id

  const variables = useMemo(
    () => ({
      contactIds: contactId ? [contactId] : undefined,
      botIds: botId ? [botId] : undefined,
      blueprintIds: effectiveBlueprintId ? [effectiveBlueprintId] : undefined,
    }),
    [effectiveBlueprintId, botId, contactId]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: TASK_LIST_QUERY,
    connection: 'tasks',
    variables,
  })

  const listRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/task/list`
    }

    if (botId) {
      return `/api/v1/task/list?botId=${botId}`
    }

    return _listRoute
  }, [_listRoute, botId, contactId])

  const effectiveScope = effectiveBlueprintId
    ? { id: effectiveBlueprintId }
    : null

  const scopedListRoute = scopeListRoute(listRoute, effectiveScope)

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute
    ? graphqlListRoute
    : scopedListRoute

  const key = useGraphQLListRoute
    ? `graphql:${contactId || 'all-contacts'}:${botId || 'all-bots'}:${effectiveBlueprintId || 'all'}`
    : typeof scopedListRoute === 'string'
      ? scopedListRoute
      : undefined

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ schedule, status, outcome, lastRunAt }) => {
        return (
          <>
            {schedule ? <div className="tag">{schedule}</div> : null}
            {status ? <div className="tag">{status}</div> : null}
            {outcome ? <div className="tag">{outcome}</div> : null}
            {lastRunAt ? (
              <div className="tag">last run {timeAgo(lastRunAt)}</div>
            ) : null}
            {/* @note expiry is rendered generically by ResourceList */}
            {/* @note hidden for now because it is confusing */}
            {/* {nextRunAt ? (
              <div className="tag">next run {timeAgo(nextRunAt)}</div>
            ) : null} */}
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
      extraTags={extraTags}
      autoLoad={hydrated && autoLoad}
      loading={loading || (!!autoLoad && !hydrated)}
    />
  )
}
