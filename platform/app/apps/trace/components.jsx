'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuTrash2 as ClearIcon,
  LuDownload as DownloadIcon,
  LuPause as PauseIcon,
  LuPlay as PlayIcon,
} from 'react-icons/lu'

import { saveData } from '@/lib/save'
import { stringify } from '@/lib/yaml'

import useCodeAction from '@/hooks/useCodeAction'
import useLocalStorage from '@/hooks/useLocalStorage'
import useThrottle from '@/hooks/useThrottle'
import { useTraceServer } from '@/hooks/useTrace'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSpacer,
  ToolbarStatus,
  ToolbarToggle,
} from '@/app/apps/_components/Toolbar'

import clsx from 'clsx'
import { VList } from 'virtua'

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

export function Item({
  col1,
  col2,
  col3,

  className,

  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        'flex flex-row gap-4',
        'px-4 py-2',
        'font-mono',
        'hover:auto-bg-gray-50',
        'transition-all duration-200',
        className
      )}
    >
      <div className="truncate w-full max-w-60">{col1}</div>
      <div className="truncate w-full max-w-36">{col2}</div>
      <div className="truncate flex-1 w-full">{col3}</div>
    </div>
  )
}

export function Header({ className, ...props }) {
  return (
    <Item
      {...props}
      className={clsx(
        'auto-bg-gray-50',
        'border-b border-gray-200 dark:border-gray-800',
        className
      )}
      col1={<div className="font-semibold">Timestamp</div>}
      col2={<div className="font-semibold">Type</div>}
      col3={<div className="font-semibold">Data</div>}
    />
  )
}

export function Row({
  timestamp,
  previousTimestamp,

  type,
  data,

  ...props
}) {
  return (
    <Item
      {...props}
      col1={
        <div className="font-semibold">
          <span>{new Date(timestamp).toISOString()}</span>
          <span
            className={clsx({
              'text-green-500': timestamp - previousTimestamp < 1000,
              'text-red-500': timestamp - previousTimestamp >= 1000,
            })}
          >
            +{timestamp - previousTimestamp}ms
          </span>
        </div>
      }
      col2={<div>{type}</div>}
      col3={<div className="whitespace-pre-wrap">{stringify(data)}</div>}
    />
  )
}

Row.Memo = memo(Row)

function EventsList({ displayEvents }) {
  return (
    <VList className="flex-1 text-xs">
      {displayEvents.map(({ type, data, timestamp }, index) => {
        return (
          <Row.Memo
            key={index}
            type={type}
            data={data}
            timestamp={timestamp}
            previousTimestamp={
              index > 0 ? displayEvents[index - 1].timestamp : timestamp
            }
          />
        )
      })}
    </VList>
  )
}

EventsList.Memo = memo(EventsList)

export function Main({}) {
  const [codeAction] = useCodeAction()

  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(recording)

  // @note keep ref in sync with state to avoid stale closures in useTraceServer callback

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  // @note persisted filter preferences using localStorage

  const [displayTokens, setDisplayTokens] = useLocalStorage(
    'trace:displayTokens',
    true
  )
  const [displayReasoningTokens, setDisplayReasoningTokens] = useLocalStorage(
    'trace:displayReasoningTokens',
    true
  )
  const [displayBotMessages, setDisplayBotMessages] = useLocalStorage(
    'trace:displayBotMessages',
    true
  )
  const [displayActivityMessages, setDisplayActivityMessages] = useLocalStorage(
    'trace:displayActivityMessages',
    true
  )

  const [events, setEvents] = useState([])

  {
    const handleEvent = useCallback((type, data) => {
      if (!recordingRef.current) {
        return
      }

      setEvents((prevEvents) => [
        ...prevEvents,

        { type, data, timestamp: Date.now() },
      ])
    }, [])

    useTraceServer(handleEvent)
  }

  const [displayEvents, setDisplayEvents] = useState(events)

  const handleExportLog = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      events,
    }

    saveData(JSON.stringify(payload, null, 2), {
      name: `trace-${Date.now()}.json`,
      type: 'application/json',
    })
  }, [events])

  {
    // @note throttle (not debounce) so the filtered view keeps updating while a
    // trace is actively recording. A trailing-edge debounce never flushed
    // during a continuous event stream (tokens arrive faster than the delay, so
    // the timer kept resetting), leaving the list frozen until recording
    // paused. Throttle caps re-filtering to once per interval while still
    // emitting fresh snapshots during the stream.

    const throttledEvents = useThrottle(events, 1000)

    const filter = useMemo(() => {
      return (event) => {
        if (!displayTokens && event.type === 'token') {
          return false
        }

        if (!displayReasoningTokens && event.type === 'reasoningToken') {
          return false
        }

        // @note guard event.data - message events are not guaranteed to carry a
        // data object, and an unguarded `.type` access throws inside .filter(),
        // which would break the whole filtering effect

        if (
          !displayBotMessages &&
          event.type === 'message' &&
          event.data?.type === 'bot'
        ) {
          return false
        }

        if (
          !displayActivityMessages &&
          event.type === 'message' &&
          event.data?.type === 'activity'
        ) {
          return false
        }

        return true
      }
    }, [
      displayTokens,
      displayReasoningTokens,
      displayBotMessages,
      displayActivityMessages,
    ])

    useEffect(() => {
      setDisplayEvents(throttledEvents.filter(filter))
    }, [throttledEvents, filter])
  }

  return (
    <>
      {codeAction}
      <div className="w-full h-screen flex flex-col">
        <AppToolbar>
          <div className="flex min-w-0 flex-1 flex-row items-center gap-2 overflow-x-auto">
            <ToolbarButton
              onClick={() => setEvents([])}
              title="Clear events"
              icon={<ClearIcon className="h-3.5 w-3.5" />}
            >
              Clear
            </ToolbarButton>
            <ToolbarToggle
              className={clsx('w-20', {
                'text-red-500': recording,
              })}
              checked={recording}
              setChecked={setRecording}
              onClick={() => setRecording((prevRecording) => !prevRecording)}
              title={recording ? 'Stop recording' : 'Start recording'}
              icon={
                recording ? (
                  <PauseIcon className="h-3.5 w-3.5" />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5" />
                )
              }
            >
              {recording ? 'Pause' : 'Start'}
            </ToolbarToggle>
            <ToolbarButton
              onClick={handleExportLog}
              title="Export complete trace log"
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
            >
              Export
            </ToolbarButton>
            <Toggle checked={displayTokens} setChecked={setDisplayTokens}>
              Tokens
            </Toggle>
            <Toggle
              checked={displayReasoningTokens}
              setChecked={setDisplayReasoningTokens}
            >
              Reasoning
            </Toggle>
            <Toggle
              checked={displayBotMessages}
              setChecked={setDisplayBotMessages}
            >
              Bot Messages
            </Toggle>
            <Toggle
              checked={displayActivityMessages}
              setChecked={setDisplayActivityMessages}
            >
              Activity
            </Toggle>
          </div>
          <ToolbarSpacer />
          <ToolbarStatus
            className={clsx({
              'text-red-500': recording,
            })}
          >
            {recording ? 'Recording' : 'Paused'}
          </ToolbarStatus>
        </AppToolbar>
        <Header className="text-xs" />
        <EventsList.Memo displayEvents={displayEvents} />
      </div>
    </>
  )
}
