'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuRefreshCcw, LuZap } from 'react-icons/lu'

import dynamic from 'next/dynamic'

import availableEvents from '@/lib/event'

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

import { listLogs, subscribeLogs } from './server'

import { consume } from '@chatbotkit/react/utils/stream'

import clsx from 'clsx'
import { VList } from 'virtua'

// @note keep ObjectView out of the initial eventlog client chunk because eager
// loading triggered an intermittent first-load webpack runtime failure in dev

const ObjectView = dynamic(() => import('@/components/ObjectView'), {
  ssr: false,
})

function getEventStatus(type) {
  // @note status is determined by event type suffix

  if (type.endsWith('.error')) {
    return 'error'
  }

  if (type.endsWith('.warning')) {
    return 'warning'
  }

  return 'success'
}

function getEventName(type) {
  const event = availableEvents.find((e) => e.type === type)

  return event?.name || type
}

function getEventDescription(type) {
  const event = availableEvents.find((e) => e.type === type)

  return event?.description || null
}

function getRelatedResources(item) {
  // @note extract related resource IDs from log item

  const resources = []

  if (item.botId) {
    resources.push({ type: 'bot', id: item.botId })
  }

  if (item.conversationId) {
    resources.push({ type: 'conversation', id: item.conversationId })
  }

  if (item.blueprintId) {
    resources.push({ type: 'blueprint', id: item.blueprintId })
  }

  if (item.datasetId) {
    resources.push({ type: 'dataset', id: item.datasetId })
  }

  if (item.skillsetId) {
    resources.push({ type: 'skillset', id: item.skillsetId })
  }

  if (item.abilityId) {
    resources.push({ type: 'ability', id: item.abilityId })
  }

  if (item.contactId) {
    resources.push({ type: 'contact', id: item.contactId })
  }

  if (item.fileId) {
    resources.push({ type: 'file', id: item.fileId })
  }

  if (item.taskId) {
    resources.push({ type: 'task', id: item.taskId })
  }

  if (item.portalId) {
    resources.push({ type: 'portal', id: item.portalId })
  }

  if (item.widgetIntegrationId) {
    resources.push({ type: 'widget', id: item.widgetIntegrationId })
  }

  if (item.slackIntegrationId) {
    resources.push({ type: 'slack', id: item.slackIntegrationId })
  }

  if (item.discordIntegrationId) {
    resources.push({ type: 'discord', id: item.discordIntegrationId })
  }

  if (item.microsoftteamsIntegrationId) {
    resources.push({ type: 'microsoftteams', id: item.microsoftteamsIntegrationId })
  }

  if (item.googlechatIntegrationId) {
    resources.push({ type: 'googlechat', id: item.googlechatIntegrationId })
  }

  if (item.telegramIntegrationId) {
    resources.push({ type: 'telegram', id: item.telegramIntegrationId })
  }

  return resources
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
      onChange={(e) => setValue(e.target.value || null)}
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
  statusFilter,
  setStatusFilter,
  liveStream,
  setLiveStream,
  onRefresh,
}) {
  const eventTypeOptions = useMemo(() => {
    const types = new Set()

    availableEvents.forEach((entry) => {
      const category = entry.type.split('.')[0]

      types.add(category)
    })

    return Array.from(types).map((type) => ({ value: type, label: type }))
  }, [])

  const statusOptions = [
    { value: 'error', label: 'Error' },
    { value: 'warning', label: 'Warning' },
    { value: 'success', label: 'Success' },
  ]

  return (
    <AppToolbar>
      <ToolbarButton onClick={onRefresh} title="Refresh">
        <LuRefreshCcw className="h-3.5 w-3.5" />
        Refresh
      </ToolbarButton>

      <Toggle
        checked={liveStream}
        setChecked={setLiveStream}
        icon={<LuZap className="h-3.5 w-3.5" />}
      >
        Live
      </Toggle>

      <ToolbarSpacer />

      <FilterSelect
        value={typeFilter}
        setValue={setTypeFilter}
        options={eventTypeOptions}
        placeholder="All Types"
      />

      <FilterSelect
        value={statusFilter}
        setValue={setStatusFilter}
        options={statusOptions}
        placeholder="All Status"
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
      <div className="w-20 font-semibold">Status</div>
      <div className="w-48 font-semibold">Type</div>
      <div className="flex-1 font-semibold">Description</div>
      <div className="w-48 font-semibold">Resources</div>
    </div>
  )
}

export function LogRow({ item, onClick, className, ...props }) {
  const status = getEventStatus(item.type)
  const name = getEventName(item.type)
  const description = item.description || getEventDescription(item.type)
  const resources = getRelatedResources(item)

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
        <span
          className="text-[10px] text-gray-400"
          suppressHydrationWarning // @note toLocaleTimeString differs between server and client due to timezone/locale
        >
          {new Date(item.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="w-20">
        <span
          className={clsx('tag text-[10px]', {
            error: status === 'error',
            warning: status === 'warning',
            success: status === 'success',
          })}
        >
          {status}
        </span>
      </div>

      <div className="w-48 truncate" title={item.type}>
        {name}
      </div>

      <div className="flex-1 truncate text-gray-600 dark:text-gray-300">
        {description || (
          <span className="italic text-gray-400">No description</span>
        )}
      </div>

      <div className="w-48 flex flex-wrap gap-1">
        {resources.slice(0, 2).map(({ type, id }) => (
          <span
            key={`${type}-${id}`}
            className="tag text-[10px] truncate max-w-20"
            title={`${type}: ${id}`}
          >
            {type}
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
    <VList
      className="flex-1"
      ssrCount={filteredItems.length} // @note prevents hydration mismatch by telling virtua how many items to render during SSR
    >
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
          No event logs found
        </div>
      ) : null}
    </VList>
  )
}

LogList.Memo = memo(LogList)

export function LogDetail({ item }) {
  const description = item.description || getEventDescription(item.type)
  const resources = getRelatedResources(item)
  const status = getEventStatus(item.type)

  return (
    <div className="space-y-4">
      <div className="flex flex-row gap-2 items-center">
        <span
          className={clsx('tag', {
            error: status === 'error',
            warning: status === 'warning',
            success: status === 'success',
          })}
        >
          {status}
        </span>
        <span className="font-mono text-sm">{item.type}</span>
      </div>

      {description ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {description}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs text-gray-500">
          <span className="font-semibold">Created:</span>{' '}
          {new Date(item.createdAt).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-semibold">ID:</span>{' '}
          <span className="font-mono">{item.id}</span>
        </div>
      </div>

      {resources.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500">
            Related Resources
          </div>
          <div className="flex flex-wrap gap-2">
            {resources.map(({ type, id }) => (
              <span key={`${type}-${id}`} className="tag text-xs" title={id}>
                {type}: <span className="font-mono">{id.slice(0, 8)}...</span>
              </span>
            ))}
          </div>
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
 * @param {import('./server').EventLogItem[]} [props.initialItems]
 * @param {string | null | undefined} [props.initialCursor]
 */
export function Main({ initialItems = [], initialCursor = null }) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  const [typeFilter, setTypeFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [liveStream, setLiveStream] = useState(false)

  const liveStreamAbortRef = useRef(null)

  const { popup, openPopup } = usePopup()

  const handleRefresh = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listLogs({})

      if (result && !('error' in result)) {
        setItems(result.items)
        setCursor(result.cursor)
      }
    } catch (e) {
      toast.error(e.message)
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
        setItems((prev) => [...prev, ...result.items])
        setCursor(result.cursor)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading])

  const handleItemClick = useCallback(
    (item) => {
      const name = getEventName(item.type)

      openPopup(<LogDetail item={item} />, {
        title: name,
        description: item.type,
        cancelButtonCaption: 'Close',
      })
    },
    [openPopup]
  )

  // @note filter items based on current filters (client-side filtering)
  const filteredItems = useMemo(() => {
    let result = items

    if (typeFilter) {
      result = result.filter((item) => item.type.startsWith(typeFilter + '.'))
    }

    if (statusFilter) {
      result = result.filter(
        (item) => getEventStatus(item.type) === statusFilter
      )
    }

    return result
  }, [items, typeFilter, statusFilter])

  // @note live streaming effect
  useEffect(() => {
    if (!liveStream) {
      return
    }

    // @note abort any previous stream before starting a new one
    liveStreamAbortRef.current?.()

    let aborted = false

    liveStreamAbortRef.current = () => {
      aborted = true
    }

    const startStream = async () => {
      try {
        const eventStream = await consume(
          subscribeLogs({
            historyLength: 10,
          })
        )

        for await (const event of eventStream) {
          if (aborted) {
            break
          }

          // @note add new events to the beginning of the list
          if (event.type === 'event' && event.data) {
            setItems((prev) => {
              // @note avoid duplicates
              if (prev.some((item) => item.id === event.data.id)) {
                return prev
              }

              return [event.data, ...prev]
            })
          }
        }

        // @note stream ended naturally (e.g., server timeout after ~15 minutes)

        if (!aborted) {
          toast('Live stream ended')

          setLiveStream(false)
        }
      } catch {
        // @note stream disconnected due to an error

        if (!aborted) {
          toast('Live stream ended')

          setLiveStream(false)
        }
      }
    }

    startStream()

    return () => {
      liveStreamAbortRef.current?.()
    }
  }, [liveStream])

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="w-full h-screen flex flex-col bg-white dark:bg-gray-950">
        <FilterBar
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          liveStream={liveStream}
          setLiveStream={setLiveStream}
          onRefresh={handleRefresh}
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
