'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { LuRefreshCcw, LuZap } from 'react-icons/lu'

import dynamic from 'next/dynamic'

import { revalue } from '@/lib/object'
import toast from '@/lib/toast'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import TimeAgo from '@/components/TimeAgo'

import usePopup from '@/hooks/usePopup'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSelect,
  ToolbarSpacer,
  ToolbarToggle,
} from '@/app/apps/_components/Toolbar'

import { listLogs } from './server'

import clsx from 'clsx'
import { VList } from 'virtua'

const ObjectView = dynamic(() => import('@/components/ObjectView'), {
  ssr: false,
})

const RESOURCE_FIELDS = [
  ['conversationId', 'conversation'],
  ['taskId', 'task'],
  ['contactId', 'contact'],
  ['spaceId', 'space'],
  ['blueprintId', 'blueprint'],
  ['botId', 'bot'],
  ['datasetId', 'dataset'],
  ['recordId', 'record'],
  ['skillsetId', 'skillset'],
  ['abilityId', 'ability'],
  ['fileId', 'file'],
  ['secretId', 'secret'],
  ['portalId', 'portal'],
  ['policyId', 'policy'],
  ['webhookId', 'webhook'],
  ['sessionId', 'session'],
]

function getActionTone(action) {
  switch (action) {
    case 'delete':
    case 'remove':
    case 'revoke':
      return 'error'
    case 'update':
    case 'change':
    case 'edit':
      return 'warning'
    default:
      return 'success'
  }
}

function getResourceLinks(item) {
  return RESOURCE_FIELDS.flatMap(([field, label]) =>
    item[field] ? [{ field, label, id: item[field] }] : []
  )
}

function getPrimaryResourceLabel(item) {
  return getResourceLinks(item)[0]?.label || 'account'
}

function getAuditDescription(item) {
  if (item.description) {
    return item.description
  }

  const resource = getPrimaryResourceLabel(item)

  if (item.action) {
    return `${item.action} ${resource}`
  }

  return 'Audit log entry without description'
}

export function Toggle({ checked, setChecked, children, className, ...props }) {
  return (
    <ToolbarToggle
      {...props}
      checked={checked}
      setChecked={setChecked}
      className={className}
    >
      {children}
    </ToolbarToggle>
  )
}

export function FilterSelect({ value, setValue, options, placeholder }) {
  return (
    <ToolbarSelect
      value={value || ''}
      onChange={(event) => setValue(event.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </ToolbarSelect>
  )
}

export function FilterBar({
  actionFilter,
  setActionFilter,
  resourceFilter,
  setResourceFilter,
  live,
  setLive,
  onRefresh,
  items,
}) {
  const actionOptions = useMemo(() => {
    const actions = Array.from(
      new Set(items.map((item) => item.action).filter(Boolean))
    ).sort()

    return actions.map((action) => ({
      value: action,
      label: action,
    }))
  }, [items])

  const resourceOptions = useMemo(() => {
    const resources = Array.from(
      new Set(
        items.flatMap((item) =>
          getResourceLinks(item).map((entry) => entry.label)
        )
      )
    ).sort()

    return resources.map((resource) => ({
      value: resource,
      label: resource,
    }))
  }, [items])

  return (
    <AppToolbar>
      <ToolbarButton onClick={onRefresh} title="Refresh">
        <LuRefreshCcw className="h-3.5 w-3.5" />
        Refresh
      </ToolbarButton>

      <Toggle
        checked={live}
        setChecked={setLive}
        icon={<LuZap className="h-3.5 w-3.5" />}
      >
        Live
      </Toggle>

      <ToolbarSpacer />

      <FilterSelect
        value={actionFilter}
        setValue={setActionFilter}
        options={actionOptions}
        placeholder="All Actions"
      />

      <FilterSelect
        value={resourceFilter}
        setValue={setResourceFilter}
        options={resourceOptions}
        placeholder="All Resources"
      />
    </AppToolbar>
  )
}

export function LogHeader({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'flex flex-row gap-4',
        'px-4 py-2',
        'font-mono text-xs',
        'auto-bg-gray-50',
        'border-b border-gray-200 dark:border-gray-800',
        className
      )}
    >
      <div className="w-36 font-semibold">Time</div>
      <div className="w-20 font-semibold">Action</div>
      <div className="w-28 font-semibold">Resource</div>
      <div className="flex-1 font-semibold">Description</div>
      <div className="w-28 font-semibold">Changes</div>
      <div className="w-48 font-semibold">Context</div>
    </div>
  )
}

export function LogRow({ item, onClick, className, ...props }) {
  const action = item.action || 'event'
  const tone = getActionTone(action)
  const resources = getResourceLinks(item)
  const description = getAuditDescription(item)
  const hasChanges = Boolean(item.oldValues || item.newValues)

  return (
    <div
      {...props}
      className={clsx(
        'flex flex-row gap-4 items-start',
        'px-4 py-3',
        'font-mono text-xs',
        'hover:auto-bg-gray-50',
        'border-b border-gray-100 dark:border-gray-900',
        'cursor-pointer',
        'transition-all duration-150',
        className
      )}
      onClick={() => onClick?.(item)}
    >
      <div className="w-36 text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
        <TimeAgo time={item.createdAt} tooltip />
        <span className="text-[10px] text-gray-400" suppressHydrationWarning>
          {new Date(item.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="w-20">
        <span
          className={clsx('tag text-[10px]', {
            error: tone === 'error',
            warning: tone === 'warning',
            success: tone === 'success',
          })}
        >
          {action}
        </span>
      </div>

      <div className="w-28 truncate" title={getPrimaryResourceLabel(item)}>
        {getPrimaryResourceLabel(item)}
      </div>

      <div className="flex-1 truncate text-gray-600 dark:text-gray-300">
        {description}
      </div>

      <div className="w-28">
        <span className="tag text-[10px]">{hasChanges ? 'diff' : 'none'}</span>
      </div>

      <div className="w-48 flex flex-wrap gap-1">
        {resources.slice(0, 2).map(({ label, id }) => (
          <span
            key={`${label}-${id}`}
            className="tag text-[10px] truncate max-w-20"
            title={`${label}: ${id}`}
          >
            {label}
          </span>
        ))}
        {resources.length > 2 ? (
          <span className="tag text-[10px]">+{resources.length - 2}</span>
        ) : null}
        {!resources.length && item.ipAddress ? (
          <span className="tag text-[10px]">ip</span>
        ) : null}
      </div>
    </div>
  )
}

LogRow.Memo = memo(LogRow)

function LogList({ filteredItems, cursor, loading, onItemClick, onLoadMore }) {
  return (
    <VList className="flex-1" ssrCount={filteredItems.length}>
      {filteredItems.map((item) => (
        <LogRow.Memo key={item.id} item={item} onClick={onItemClick} />
      ))}

      {cursor ? (
        <div className="flex justify-center py-4">
          <button
            type="button"
            className="default-button text-xs"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      ) : null}

      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-xs font-mono">
          No audit logs found
        </div>
      ) : null}
    </VList>
  )
}

LogList.Memo = memo(LogList)

function DetailSection({ title, object }) {
  if (!object) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <ObjectView
        className="text-xs max-h-64 overflow-auto"
        object={revalue(object, null)}
      />
    </div>
  )
}

export function LogDetail({ item }) {
  const action = item.action || 'event'
  const tone = getActionTone(action)
  const resources = getResourceLinks(item)

  return (
    <div className="space-y-4">
      <div className="flex flex-row gap-2 items-center">
        <span
          className={clsx('tag', {
            error: tone === 'error',
            warning: tone === 'warning',
            success: tone === 'success',
          })}
        >
          {action}
        </span>
        <span className="font-mono text-sm">
          {getPrimaryResourceLabel(item)}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        {getAuditDescription(item)}
      </p>

      <div className="space-y-2">
        <div className="text-xs text-gray-500">
          <span className="font-semibold">Created:</span>{' '}
          {new Date(item.createdAt).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-semibold">ID:</span>{' '}
          <span className="font-mono">{item.id}</span>
        </div>
        {item.ipAddress ? (
          <div className="text-xs text-gray-500">
            <span className="font-semibold">IP:</span>{' '}
            <span className="font-mono">{item.ipAddress}</span>
          </div>
        ) : null}
        {item.userAgent ? (
          <div className="text-xs text-gray-500 break-all">
            <span className="font-semibold">User Agent:</span> {item.userAgent}
          </div>
        ) : null}
      </div>

      {resources.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500">
            Related Resources
          </div>
          <div className="flex flex-wrap gap-2">
            {resources.map(({ label, id }) => (
              <span key={`${label}-${id}`} className="tag text-xs" title={id}>
                {label}:{' '}
                <span className="font-mono">{String(id).slice(0, 8)}...</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <DetailSection title="Previous Values" object={item.oldValues} />
      <DetailSection title="New Values" object={item.newValues} />
      <DetailSection title="Metadata" object={item.meta} />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500">Full Data</div>
        <ObjectView
          className="text-xs max-h-64 overflow-auto"
          object={revalue(item, null)}
        />
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('./server').AuditLogItem[]} [props.initialItems]
 * @param {string | null | undefined} [props.initialCursor]
 */
export function Main({ initialItems = [], initialCursor = null }) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  const [actionFilter, setActionFilter] = useState(null)
  const [resourceFilter, setResourceFilter] = useState(null)
  const [live, setLive] = useState(false)

  const { popup, openPopup } = usePopup()

  const handleRefresh = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listLogs({})

      if (result && !('error' in result)) {
        setItems(result.items)
        setCursor(result.cursor)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoadMore = useCallback(async () => {
    if (!cursor || loading) {
      return
    }

    setLoading(true)

    try {
      const result = await listLogs({
        cursor,
      })

      if (result && !('error' in result)) {
        setItems((previous) => [...previous, ...result.items])
        setCursor(result.cursor)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading])

  const handleItemClick = useCallback(
    (item) => {
      openPopup(<LogDetail item={item} />, {
        title: item.name || item.action || 'Audit Log Entry',
        description: getAuditDescription(item),
        cancelButtonCaption: 'Close',
      })
    },
    [openPopup]
  )

  const filteredItems = useMemo(() => {
    let result = items

    if (actionFilter) {
      result = result.filter((item) => item.action === actionFilter)
    }

    if (resourceFilter) {
      result = result.filter((item) =>
        getResourceLinks(item).some((entry) => entry.label === resourceFilter)
      )
    }

    return result
  }, [actionFilter, items, resourceFilter])

  useEffect(() => {
    if (!live) {
      return undefined
    }

    const interval = setInterval(handleRefresh, 30000)

    return () => clearInterval(interval)
  }, [live, handleRefresh])

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="w-full h-screen flex flex-col bg-white dark:bg-gray-950">
        <FilterBar
          actionFilter={actionFilter}
          setActionFilter={setActionFilter}
          resourceFilter={resourceFilter}
          setResourceFilter={setResourceFilter}
          live={live}
          setLive={setLive}
          onRefresh={handleRefresh}
          items={items}
        />

        <LogHeader />

        <LogList.Memo
          filteredItems={filteredItems}
          cursor={cursor}
          loading={loading}
          onItemClick={handleItemClick}
          onLoadMore={handleLoadMore}
        />

        {loading && items.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-950/50">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : null}
      </div>
    </>
  )
}
