'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { timeAgo } from '@chatbotkit-dev/time'

import fetch from '@/lib/fetch'
import { icons, actions as integrationActions } from '@/lib/integration.items'

import Link from '@/components/Link'
import ResourceList from '@/components/ResourceList'

import usePopup from '@/hooks/usePopup'
import useProjectScope from '@/hooks/useProjectScope'

import clsx from 'clsx'

// Integrations render as a single merged list across every integration type.
// The table below is the source of truth: it drives the combined GraphQL
// query, the type tag on every row, and the private (development and staging
// only) gating.
export const INTEGRATION_TYPES = [
  { type: 'widget', connection: 'widgetIntegrations' },
  { type: 'slack', connection: 'slackIntegrations' },
  { type: 'github', connection: 'githubIntegrations' },
  { type: 'discord', connection: 'discordIntegrations' },
  { type: 'microsoftteams', connection: 'microsoftteamsIntegrations' },
  { type: 'googlechat', connection: 'googlechatIntegrations' },
  { type: 'whatsapp', connection: 'whatsappIntegrations' },
  { type: 'messenger', connection: 'messengerIntegrations' },
  { type: 'instagram', connection: 'instagramIntegrations' },
  { type: 'telegram', connection: 'telegramIntegrations' },
  { type: 'twilio', connection: 'twilioIntegrations' },
  { type: 'email', connection: 'emailIntegrations' },
  {
    type: 'sitemap',
    connection: 'sitemapIntegrations',
    fields: 'syncStatus syncSchedule lastSyncedAt',
  },
  {
    type: 'notion',
    connection: 'notionIntegrations',
    fields: 'syncStatus syncSchedule lastSyncedAt',
  },
  {
    type: 'trigger',
    connection: 'triggerIntegrations',
    fields: 'schedule lastTriggerAt',
  },
  {
    type: 'support',
    connection: 'supportIntegrations',
    fields: 'bot { name }',
  },
  {
    type: 'extract',
    connection: 'extractIntegrations',
    fields: 'bot { name }',
  },
  { type: 'mcpserver', connection: 'mcpserverIntegrations' },
  { type: 'skillserver', connection: 'skillserverIntegrations' },
  { type: 'anam', connection: 'anamIntegrations', private: true },
  { type: 'avatar', connection: 'avatarIntegrations', private: true },
  { type: 'recall', connection: 'recallIntegrations', private: true },
]

// @note every connection is capped at its first 100 integrations. When a
// blueprintId is given the filter runs server side so older integrations of
// the scoped project are not lost beyond the cap
function buildIntegrationsQuery(types, blueprintId = null) {
  const filter = blueprintId
    ? `, blueprintIds: ${JSON.stringify([blueprintId])}`
    : ''

  return `query IntegrationsIndex {
${types
  .map(
    ({ connection, fields }) => `  ${connection}(first: 100${filter}) {
    edges {
      node {
        id
        name
        description
        createdAt
        blueprint {
          id
        }${fields ? `\n        ${fields}` : ''}
      }
    }
  }`
  )
  .join('\n')}
}`
}

// @note a stable identity keeps the controlled item state from resetting on
// every render of a self-fetching list
const EMPTY_ITEMS = []

export function IntegrationIcon({ type, className }) {
  const Icon = icons[type]

  return (
    <Icon className={clsx('flex-shrink-0 auto-text-gray-900', className)} />
  )
}

// @note ResourceList renders icons through DynamicIcon, which accepts a
// component; the per-type wrappers keep a stable identity so rows do not
// remount on every render
const iconComponents = Object.fromEntries(
  Object.keys(icons).map((type) => [
    type,
    function Icon({ className }) {
      return <IntegrationIcon className={className} type={type} />
    },
  ])
)

function iconMapper({ type }) {
  return iconComponents[type]
}

function descriptionMapper({ description }) {
  return (
    description || (
      <span className="italic">An integration without description</span>
    )
  )
}

function extraTags({
  type,

  bot,

  syncStatus,
  syncSchedule,
  lastSyncedAt,

  schedule,

  lastTriggerAt,
}) {
  return (
    <>
      <div className="tag">{type}</div>
      {(type === 'support' || type === 'extract') &&
        (bot?.name ? (
          <div className="tag" title={`Bot: ${bot.name}`}>
            <span>bot: {bot.name}</span>
          </div>
        ) : (
          <div className="tag" title="Applies to all bots">
            <span>all bots</span>
          </div>
        ))}
      {syncStatus === 'synced' && (
        <div className="tag tag-success" title={`Sync status: ${syncStatus}`}>
          <span>synced</span>
        </div>
      )}
      {syncStatus === 'pending' && (
        <div className="tag tag-warning" title={`Sync status: ${syncStatus}`}>
          <span>pending</span>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="tag tag-danger" title={`Sync status: ${syncStatus}`}>
          <span>error</span>
        </div>
      )}
      {syncSchedule ? (
        <div className="tag" title={`Sync schedule ${syncSchedule}`}>
          <span>sync schedule {syncSchedule}</span>
        </div>
      ) : null}
      {lastSyncedAt ? (
        <div className="tag" title={`Last sync ${timeAgo(lastSyncedAt)}`}>
          <span>last sync {timeAgo(lastSyncedAt)}</span>
        </div>
      ) : null}
      {schedule ? (
        <div className="tag" title={`Trigger schedule ${schedule}`}>
          <span>trigger schedule {schedule}</span>
        </div>
      ) : null}
      {lastTriggerAt ? (
        <div className="tag" title={`Last run ${timeAgo(lastTriggerAt)}`}>
          <span>last triggered {timeAgo(lastTriggerAt)}</span>
        </div>
      ) : null}
    </>
  )
}

// The query parameter the new integration route of each type reads to
// preselect the resource the integration is created from.
const RESOURCE_QUERY_PARAMS = {
  bot: 'botId',
  dataset: 'datasetId',
  skillset: 'skillsetId',
}

/**
 * The merged list of integrations across every type, rendered through the
 * standard ResourceList so loading, empty, error, and delete states behave
 * like every other resource index. Without an `integrations` prop the list
 * fetches its own data through the GraphQL integration connections; pass
 * `integrations` to render a pre-supplied set instead (the bot, dataset, and
 * skillset pages pass the integrations embedded in their resource payloads).
 *
 * Pass `resource` as `{ type, id }` to render the list from the page of the
 * resource the integrations belong to. The create action then offers only the
 * integrations which attach to that type and takes the user to the new route
 * of the chosen integration with the resource already selected.
 */
export default function IntegrationList({
  authenticated,

  integrations,

  showPrivateIntegrations = false,

  scopeAware = false,

  resource,

  actions,

  filter = false,

  autoLoad = integrations == null,

  loading,

  ...props
}) {
  const selfFetching = integrations == null

  const { hydrated, scope } = useProjectScope()

  const visibleTypes = useMemo(
    () =>
      INTEGRATION_TYPES.filter(
        ({ private: isPrivate }) => !isPrivate || showPrivateIntegrations
      ),
    [showPrivateIntegrations]
  )

  // @note the scope is part of the query, so wait for it to hydrate before
  // fetching; the list remounts through its key when the scope changes
  const scopeBlueprintId = scopeAware ? scope?.id || null : null

  // @note the merged multi-connection query cannot paginate as one stream,
  // so the list route loads everything in a single page and reports no
  // cursor, which marks the list as exhausted
  const listRoute = useCallback(async () => {
    const response = await fetch('/api/v1/graphql', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        query: buildIntegrationsQuery(visibleTypes, scopeBlueprintId),
      }),
    })

    const data = await response.json()

    if (!response.ok || data?.errors?.length) {
      throw new Error(
        data?.errors?.[0]?.message || data?.message || 'GraphQL request failed'
      )
    }

    return {
      items: visibleTypes
        .flatMap(({ type, connection }) =>
          (data?.data?.[connection]?.edges || []).map(({ node }) => ({
            ...node,
            type,
            blueprintId: node.blueprint?.id ?? null,
            createdAt: new Date(node.createdAt).getTime(),
          }))
        )
        .sort((a, b) => b.createdAt - a.createdAt),
      cursor: null,
    }
  }, [visibleTypes, scopeBlueprintId])

  // @note the client side filter remains for the pre-supplied integrations
  // path; self-fetched lists arrive already scoped by the query. The memo
  // keys on the scope id rather than the scope object so a new scope identity
  // cannot churn the items below
  const suppliedItems = useMemo(() => {
    if (selfFetching) {
      return EMPTY_ITEMS
    }

    if (!scopeBlueprintId) {
      return integrations
    }

    return integrations.filter(
      ({ blueprintId }) => blueprintId === scopeBlueprintId
    )
  }, [selfFetching, integrations, scopeBlueprintId])

  // @note the pre-supplied path drives ResourceList as a controlled list so
  // late arriving integrations replace the rendered set (ResourceList only
  // reads `defaultItems` once) while its optimistic delete still writes back
  const [items, setItems] = useState(suppliedItems)

  useEffect(() => {
    setItems(suppliedItems)
  }, [suppliedItems])

  const { popup, openPopup } = usePopup({ closePopupOnClickOutside: true })

  // @note without a resource every integration is on offer; from the page of a
  // resource only the integrations which attach to it are
  const createActions = useMemo(
    () =>
      integrationActions
        .filter(({ hidden }) => !hidden)
        .filter(({ resource: type }) => !resource || type === resource.type),
    [resource]
  )

  const createQuery = useMemo(() => {
    const param = RESOURCE_QUERY_PARAMS[resource?.type]

    if (!param || !resource?.id) {
      return ''
    }

    return `?${param}=${encodeURIComponent(resource.id)}`
  }, [resource])

  function openNewIntegrationPopup() {
    openPopup(
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
        {createActions.map(({ slug, title, linkTitle, link }) => (
          <Link
            key={slug}
            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-center transition-colors"
            href={link || `/integrations/${slug}/new${createQuery}`}
            {...(link ? { target: '_blank' } : null)}
          >
            <IntegrationIcon className="w-10 h-10" type={slug} />
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight line-clamp-2">
              {linkTitle || title}
            </span>
          </Link>
        ))}
      </div>,
      {
        title: 'Create Integration',
        noActions: true,
      }
    )
  }

  return (
    <>
      {popup}
      <ResourceList
        key={selfFetching ? `graphql:${scopeBlueprintId || 'all'}` : undefined}
        {...props}
        kind="integration"
        listRoute={selfFetching ? listRoute : null}
        deleteRoute={{
          fn: ({ type, id }) => `/api/v1/integration/${type}/${id}/delete`,
        }}
        instanceRoute={{
          fn: ({ type, id }) => `/integrations/${type}/${id}`,
        }}
        items={selfFetching ? undefined : items}
        setItems={selfFetching ? undefined : setItems}
        filter={filter}
        loadMore={false}
        autoLoad={autoLoad && (!scopeAware || hydrated)}
        loading={loading || (!!autoLoad && scopeAware && !hydrated)}
        actions={
          authenticated ? (
            <button
              className="primary-button"
              type="button"
              onClick={openNewIntegrationPopup}
            >
              Create Integration
            </button>
          ) : null
        }
        trailingActions={
          resource ? (
            <>
              <button
                className="text-sm default-link"
                type="button"
                onClick={openNewIntegrationPopup}
              >
                Create integration
              </button>
              {actions}
            </>
          ) : (
            actions
          )
        }
        iconMapper={iconMapper}
        descriptionMapper={descriptionMapper}
        extraTags={extraTags}
      />
    </>
  )
}
