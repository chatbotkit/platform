'use client'

import { useMemo, useState } from 'react'
import {
  LuArrowUpRight,
  LuCircleDot,
  LuCopy,
  LuFileSearch,
  LuLink2,
} from 'react-icons/lu'

import CopyButton from '@/components/CopyButton'
import Link from '@/components/Link'
import ObjectView from '@/components/ObjectView'
import SimpleTabs from '@/components/SimpleTabs'
import TimeAgo from '@/components/TimeAgo'

import clsx from 'clsx'

function getDisplayTitle(resource, context) {
  if (!resource) {
    return context?.id || 'Unknown resource'
  }

  return (
    resource.name ||
    resource.email ||
    resource.title ||
    resource.alias ||
    resource.label ||
    resource.id ||
    context?.id ||
    'Unknown resource'
  )
}

function formatValue(value) {
  if (typeof value === 'string' && value) {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center p-8 text-center font-mono text-xs text-gray-400">
      <div>{title}</div>
      {description ? <div className="mt-1 max-w-md">{description}</div> : null}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </div>
  )
}

function ResourceCard({ label, id, active = false, href }) {
  const body = (
    <div
      className={clsx(
        'flex items-start gap-3 border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-900',
        active ? 'auto-bg-gray-50' : 'hover:auto-bg-gray-50'
      )}
    >
      <div
        className={clsx(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border',
          active
            ? 'border-gray-300 auto-bg-gray-100 auto-text-gray-900'
            : 'auto-border-gray-200 auto-bg-gray-100 auto-text-gray-500'
        )}
      >
        <LuCircleDot className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium auto-text-gray-900">
          {label}
        </div>
        <div className="mt-1 truncate font-mono text-xs auto-text-gray-500">
          {id}
        </div>
      </div>
    </div>
  )

  if (!href) {
    return body
  }

  return (
    <Link
      className="block no-underline"
      href={{ pathname: '/apps/41f203dc', query: { inspect: href } }}
    >
      {body}
    </Link>
  )
}

function PropertyList({ resource, context }) {
  const items = useMemo(() => {
    const pairs = [
      ['Resource', context?.label],
      ['ID', context?.id],
      ['Path', context?.dashboardPath],
      ['API', context?.apiPath],
    ]

    for (const key of ['name', 'email', 'description', 'alias', 'visibility']) {
      const value = formatValue(resource?.[key])

      if (value) {
        pairs.push([key, value])
      }
    }

    return pairs.filter(([, value]) => value)
  }, [context, resource])

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded border auto-border-gray-200 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </div>
          <div className="mt-1 break-all font-mono text-xs auto-text-gray-900">
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ items, emptyTitle, emptyDescription }) {
  const [selectedId, setSelectedId] = useState(null)

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) || null
  }, [items, selectedId])

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
      <div className="overflow-hidden rounded border auto-border-gray-200">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx(
              'block w-full border-b px-4 py-3 text-left transition-colors last:border-b-0',
              selectedId === item.id
                ? 'auto-bg-gray-50'
                : 'auto-border-gray-200 hover:auto-bg-gray-50'
            )}
            onClick={() =>
              setSelectedId((current) => (current === item.id ? null : item.id))
            }
          >
            <div className="flex items-center gap-3 text-xs auto-text-gray-500">
              <span className="font-mono">{item.id}</span>
              <span>&middot;</span>
              <TimeAgo date={item.createdAt || item.updatedAt || Date.now()} />
            </div>
            <div className="mt-2 text-sm font-medium auto-text-gray-900">
              {item.name || item.action || item.type || 'Activity'}
            </div>
            <div className="mt-1 truncate text-xs auto-text-gray-600">
              {item.description || 'Open to inspect the full payload.'}
            </div>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        {selectedItem ? (
          <ObjectView
            className="rounded text-xs border auto-border-gray-200 auto-bg-white"
            object={selectedItem}
          />
        ) : (
          <EmptyState
            title="Select an item"
            description="Choose an event or audit entry to inspect its full payload."
          />
        )}
      </div>
    </div>
  )
}

export function Main({
  inspect,
  pathname,
  context,
  resource,
  relatedResources,
  events,
  auditLogs,
}) {
  const title = useMemo(
    () => getDisplayTitle(resource, context),
    [resource, context]
  )

  const dataPanel = (
    <div className="space-y-4">
      <PropertyList resource={resource} context={context} />
      {resource ? (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Object data
          </div>
          <ObjectView
            className="rounded text-xs border auto-border-gray-200 auto-bg-white"
            object={resource}
          />
        </div>
      ) : (
        <EmptyState
          title="No resource data"
          description="This route resolved to a resource, but the resource payload could not be fetched."
        />
      )}
    </div>
  )

  const tabs = [
    {
      title: 'Data',
      default: true,
      content: dataPanel,
    },
    {
      title: 'Event Log',
      content: (
        <ActivityList
          items={events}
          emptyTitle="No events for this resource"
          emptyDescription="Recent platform events tied to this resource will appear here."
        />
      ),
    },
    {
      title: 'Audit Logs',
      content: (
        <ActivityList
          items={auditLogs}
          emptyTitle="No audit logs for this resource"
          emptyDescription="When this resource is changed through audited flows, those entries will show here."
        />
      ),
    },
  ]

  if (!context) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-950">
        <aside className="flex min-h-0 w-full max-w-[26rem] flex-col border-r border-gray-200 dark:border-gray-800">
          <SectionLabel>Inspecting</SectionLabel>
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-900">
            <div className="truncate font-mono text-xs auto-text-gray-900">
              {inspect || pathname}
            </div>
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1">
          <EmptyState title="This resource is not inspectable yet" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-950">
      <aside className="flex min-h-0 w-full max-w-[26rem] flex-col border-r border-gray-200 dark:border-gray-800">
        <SectionLabel>Inspecting</SectionLabel>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-900">
          <div className="flex items-center gap-2">
            <LuFileSearch className="h-4 w-4 shrink-0 auto-text-gray-500" />
            <div className="min-w-0 flex-1 truncate font-mono text-xs auto-text-gray-900">
              {inspect || context.dashboardPath}
            </div>
            <CopyButton
              aria-label="Copy inspect path"
              className="auto-text-gray-400 hover:auto-text-gray-800"
              text={inspect || context.dashboardPath}
              message="Inspect path copied"
            >
              <LuCopy className="h-4 w-4" />
            </CopyButton>
          </div>
        </div>

        <SectionLabel>Resource</SectionLabel>
        <div>
          <ResourceCard active={true} id={context.id} label={context.label} />
        </div>

        <SectionLabel>Related Resources</SectionLabel>
        <div className="min-h-0 flex-1 overflow-auto subtle-scrollbar">
          {relatedResources.length ? (
            relatedResources.map((item) => (
              <ResourceCard
                key={`${item.type}:${item.id}`}
                href={item.path}
                id={item.id}
                label={item.label}
              />
            ))
          ) : (
            <div className="flex items-center justify-center px-4 py-8 text-center font-mono text-xs text-gray-400">
              No related resources were found on this object.
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold auto-text-gray-900">
                {title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs auto-text-gray-500">
                <span className="font-mono">
                  {context.apiPath.replace('/api', '')}
                </span>
                <span className="tag font-mono text-[10px]">{context.id}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="tag hover:tag-darker inline-flex h-7 items-center gap-1.5 px-2 text-xs leading-none no-underline"
                href={context.dashboardPath}
                target="_top"
              >
                Open resource
                <LuArrowUpRight className="h-4 w-4" />
              </Link>
              <div className="tag inline-flex h-7 items-center gap-1.5 px-2 text-xs leading-none">
                <LuLink2 className="h-4 w-4" />
                {relatedResources.length} related
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-4">
            <SimpleTabs
              className="flex h-full min-h-0 flex-col space-y-4"
              panelClassName="h-full overflow-y-auto pr-1"
              panelsClassName="min-h-0 flex-1"
              tabListClassName="shrink-0"
              tabs={tabs}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
