'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useProjectScope from '@/hooks/useProjectScope'

// @note channel integration filters arrive as e.g. `widgetIntegrationId` and map
// to the conversation meta path `meta.<channel>.integrationId` - the tag each
// integration's queue handler writes onto the conversations it creates. This
// list is the single source of truth for which channels are filterable;
// pages derive their query parameter names from it.
export const INTEGRATION_FILTER_CHANNELS = [
  'widget',
  'email',
  'whatsapp',
  'messenger',
  'instagram',
  'slack',
  'discord',
  'microsoftteams',
  'googlechat',
  'telegram',
  'twilio',
  'anam',
  'recall',
  'trigger',
  'github',
]

const DEFAULT_LIST_ROUTE = '/api/v1/conversation/list'

const CONVERSATION_LIST_QUERY = `
  query ResourceListConversations(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $contactIds: [ID!]
    $botIds: [ID!]
    $taskIds: [ID!]
    $meta: JsonObject
  ) {
    conversations(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      contactIds: $contactIds
      botIds: $botIds
      taskIds: $taskIds
      meta: $meta
    ) {
      edges {
        node {
          id
          name
          description
          expiresAt
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

export default function ConversationList({
  kind = 'conversation',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = '/api/v1/conversation/export',

  deleteRoute = '/api/v1/conversation/[id]/delete',

  instanceRoute = '/conversations/[id]',

  filter = true,

  contactId,

  botId,

  taskId,

  app,
  abuse,

  autoLoad,
  loading,

  ...props
}) {
  const {
    hydrated,
    resourcesHydrated,
    scope,
    botIds: projectBotIds,
  } = useProjectScope()

  // @note pull the channel integration filters out of the remaining props so
  // they drive the list route instead of leaking through to ResourceList. In
  // graphql mode every matched channel applies (each becomes its own meta
  // path); route mode supports a single integration filter and uses the
  // first match in INTEGRATION_FILTER_CHANNELS order.
  const restProps = { ...props }

  const integrationFilters = []

  for (const channel of INTEGRATION_FILTER_CHANNELS) {
    const key = `${channel}IntegrationId`

    if (restProps[key]) {
      integrationFilters.push({ channel, integrationId: restProps[key] })
    }

    delete restProps[key]
  }

  const primaryIntegrationChannel = integrationFilters[0]?.channel
  const primaryIntegrationId = integrationFilters[0]?.integrationId

  const integrationFilterKey = integrationFilters
    .map(({ channel, integrationId }) => `${channel}=${integrationId}`)
    .join(':')

  const meta = useMemo(() => {
    const value = {}

    if (app) {
      value.app = app
    }

    if (abuse !== undefined) {
      value.abuse = { flagged: abuse }
    }

    for (const { channel, integrationId } of integrationFilters) {
      value[channel] = { integrationId }
    }

    return Object.keys(value).length > 0 ? value : undefined
    // @note the filters array is rebuilt every render; its serialized form
    // keys the memo instead so meta identity stays stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abuse, app, integrationFilterKey])

  const variables = useMemo(() => {
    const botIds = scope
      ? botId
        ? projectBotIds.includes(botId)
          ? [botId]
          : []
        : projectBotIds
      : botId
        ? [botId]
        : undefined

    return {
      contactIds: contactId ? [contactId] : undefined,
      botIds,
      taskIds: taskId ? [taskId] : undefined,
      meta,
    }
  }, [botId, contactId, meta, projectBotIds, scope, taskId])

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: CONVERSATION_LIST_QUERY,
    connection: 'conversations',
    variables,
  })

  const listRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/conversation/list`
    }

    if (botId) {
      return `/api/v1/conversation/list?botId=${botId}`
    }

    if (taskId) {
      return `/api/v1/conversation/list?taskId=${taskId}`
    }

    if (primaryIntegrationChannel) {
      return `/api/v1/conversation/list?meta.${primaryIntegrationChannel}.integrationId=${primaryIntegrationId}`
    }

    return _listRoute
  }, [
    _listRoute,
    contactId,
    botId,
    taskId,
    primaryIntegrationChannel,
    primaryIntegrationId,
  ])

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute ? graphqlListRoute : listRoute

  const key = useGraphQLListRoute
    ? `graphql:${scope?.id || 'all-projects'}:${projectBotIds?.join(',') || 'all-bots'}:${contactId || 'all-contacts'}:${botId || 'all-bots'}:${taskId || 'all-tasks'}:${app || 'all-apps'}:${abuse === undefined ? 'all-abuse' : String(abuse)}:${integrationFilterKey || 'all-integrations'}`
    : listRoute

  return (
    <ResourceList
      key={key}
      {...restProps}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      autoLoad={hydrated && resourcesHydrated && autoLoad}
      loading={
        loading ||
        (!!autoLoad && (!hydrated || !resourcesHydrated)) ||
        undefined
      }
    />
  )
}
