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
  ['messageId', 'message'],
  ['taskId', 'task'],
  ['contactId', 'contact'],
  ['blueprintId', 'blueprint'],
  ['botId', 'bot'],
  ['datasetId', 'dataset'],
  ['skillsetId', 'skillset'],
  ['abilityId', 'ability'],
]

function getUsageCategory(type) {
  return type.split('/')[0] || type
}

function getResourceLinks(item) {
  return RESOURCE_FIELDS.flatMap(([field, label]) =>
    item[field] ? [{ field, label, id: item[field] }] : []
  )
}

function getPrimaryResourceLabel(item) {
  return getResourceLinks(item)[0]?.label || 'account'
}

function getUsageDescription(item) {
  if (item.meta?.reason && typeof item.meta.reason === 'string') {
    return item.meta.reason
  }

  const category = getUsageCategory(item.type)
  const resource = getPrimaryResourceLabel(item)

  return `${category} usage recorded for ${resource}`
}

function getUsageModel(item) {
  if (item.meta?.model && typeof item.meta.model === 'string') {
    return item.meta.model
  }

  if (Array.isArray(item.meta?.lineItems)) {
    const models = Array.from(
      new Set(
        item.meta.lineItems
          .map((lineItem) => lineItem?.model)
          .filter((model) => typeof model === 'string')
      )
    )

    if (models.length === 1) {
      return models[0]
    }

    if (models.length > 1) {
      return models.join(', ')
    }
  }

  return null
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
  typeFilter,
  setTypeFilter,
  resourceFilter,
  setResourceFilter,
  live,
  setLive,
  onRefresh,
  items,
}) {
  const typeOptions = useMemo(() => {
    const categories = Array.from(
      new Set(items.map((item) => getUsageCategory(item.type)).filter(Boolean))
    ).sort()

    return categories.map((category) => ({
      value: category,
      label: category,
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
        value={typeFilter}
        setValue={setTypeFilter}
        options={typeOptions}
        placeholder="All Types"
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
      <div className="w-20 font-semibold">Units</div>
      <div className="w-40 font-semibold">Type</div>
      <div className="flex-1 font-semibold">Description</div>
      <div className="w-40 font-semibold">Model</div>
      <div className="w-48 font-semibold">Resources</div>
    </div>
  )
}

export function LogRow({ item, onClick, className, ...props }) {
  const resources = getResourceLinks(item)
  const model = getUsageModel(item)

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
        <span className="tag text-[10px]">{item.count}</span>
      </div>

      <div className="w-40 truncate" title={item.type}>
        {item.type}
      </div>

      <div className="flex-1 truncate text-gray-600 dark:text-gray-300">
        {getUsageDescription(item)}
      </div>

      <div className="w-40 truncate text-gray-500 dark:text-gray-400">
        {model || <span className="italic">n/a</span>}
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
          No usage logs found
        </div>
      ) : null}
    </VList>
  )
}

LogList.Memo = memo(LogList)

export function LogDetail({ item }) {
  const resources = getResourceLinks(item)
  const model = getUsageModel(item)

  return (
    <div className="space-y-4">
      <div className="flex flex-row gap-2 items-center">
        <span className="tag">{item.count} units</span>
        <span className="font-mono text-sm">{item.type}</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        {getUsageDescription(item)}
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
        {model ? (
          <div className="text-xs text-gray-500">
            <span className="font-semibold">Model:</span>{' '}
            <span className="font-mono">{model}</span>
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

      {item.meta ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500">Metadata</div>
          <ObjectView
            className="text-xs max-h-64 overflow-auto"
            object={revalue(item.meta, null)}
          />
        </div>
      ) : null}

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
 * @param {import('./server').UsageLogItem[]} [props.initialItems]
 * @param {string | null | undefined} [props.initialCursor]
 */
export function Main({ initialItems = [], initialCursor = null }) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  const [typeFilter, setTypeFilter] = useState(null)
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
        title: item.type,
        description: getUsageDescription(item),
        cancelButtonCaption: 'Close',
      })
    },
    [openPopup]
  )

  const filteredItems = useMemo(() => {
    let result = items

    if (typeFilter) {
      result = result.filter(
        (item) => getUsageCategory(item.type) === typeFilter
      )
    }

    if (resourceFilter) {
      result = result.filter((item) =>
        getResourceLinks(item).some((entry) => entry.label === resourceFilter)
      )
    }

    return result
  }, [items, resourceFilter, typeFilter])

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
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
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
