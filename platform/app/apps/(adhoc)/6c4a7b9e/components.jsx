'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AppNavExtra } from '@/layouts/App'

function getChatSessionUrl(id) {
  const params = new URLSearchParams()

  params.set('embed', 'workspace')
  params.set('session', String(id))

  return `/apps/chat?${params.toString()}`
}

function SessionPanel({ sessionId, index, total, onClose, sessionRef }) {
  const src = useMemo(() => getChatSessionUrl(sessionId), [sessionId])

  return (
    <section
      ref={sessionRef}
      data-testid="chat-session"
      className="relative flex h-full w-full shrink-0 snap-start snap-always flex-col border-r border-gray-200 bg-white last:border-r-0 dark:border-gray-800 dark:bg-black sm:w-1/2 xl:w-1/3 2xl:w-1/4"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Thread {index + 1}
          </div>
        </div>
        <button
          className="default-button small"
          type="button"
          onClick={() => onClose(sessionId)}
          disabled={total === 1}
          aria-label={`Close thread ${index + 1}`}
          title={
            total === 1
              ? 'Open another thread before closing this one'
              : undefined
          }
        >
          Close
        </button>
      </div>
      <iframe
        title={`Chat Thread ${index + 1}`}
        src={src}
        className="h-full w-full flex-1 border-0 bg-white dark:bg-black"
        loading={index === 0 ? 'eager' : 'lazy'}
      />
    </section>
  )
}

export function Main() {
  const nextSessionIdRef = useRef(2)
  const sessionRefs = useRef(new Map())

  const [sessions, setSessions] = useState([1])
  const [pendingSessionId, setPendingSessionId] = useState(null)

  useEffect(() => {
    if (pendingSessionId == null) {
      return
    }

    sessionRefs.current
      .get(pendingSessionId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' })

    setPendingSessionId(null)
  }, [pendingSessionId, sessions])

  const handleAddSession = useCallback(() => {
    const nextSessionId = nextSessionIdRef.current++

    setSessions((sessions) => [...sessions, nextSessionId])
    setPendingSessionId(nextSessionId)
  }, [])

  const handleCloseSession = useCallback((sessionId) => {
    setSessions((sessions) => {
      if (sessions.length === 1) {
        return sessions
      }

      return sessions.filter((id) => id !== sessionId)
    })
  }, [])

  return (
    <>
      <AppNavExtra>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {sessions.length} thread{sessions.length !== 1 ? 's' : ''}
        </span>
        <button
          className="primary-button small pointer-events-auto"
          type="button"
          onClick={handleAddSession}
        >
          Add Thread
        </button>
      </AppNavExtra>
      <div
        data-testid="chat-session-scroller"
        className="absolute inset-0 top-14 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden bg-gray-100 dark:bg-gray-900"
      >
        {sessions.map((sessionId, index) => (
          <SessionPanel
            key={sessionId}
            sessionId={sessionId}
            index={index}
            total={sessions.length}
            onClose={handleCloseSession}
            sessionRef={(node) => {
              if (node) {
                sessionRefs.current.set(sessionId, node)
              } else {
                sessionRefs.current.delete(sessionId)
              }
            }}
          />
        ))}
      </div>
    </>
  )
}
