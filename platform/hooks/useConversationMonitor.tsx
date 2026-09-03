'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import fetch, { jsonl } from '@/lib/fetch'

/**
 * A single curated monitor event as published by the conversation monitor sink.
 * `data` shape depends on `type` (message, operationBegin/End, error, etc.).
 */
export interface ConversationMonitorEvent {
  type: string
  data: unknown
  createdAt: number
}

/**
 * Stream envelope produced by the channel subscribe endpoint.
 */
interface ConversationMonitorStreamItem {
  type: 'message'
  data: ConversationMonitorEvent
}

export interface UseConversationMonitorOptions {
  /**
   * Whether to maintain the connection. The hook is also implicitly disabled
   * when no conversationId is provided. @default true
   */
  enabled?: boolean

  /**
   * Number of recent events to replay when connecting, so a freshly opened view
   * shows recent activity before following live. @default 50
   */
  historyLength?: number

  /**
   * Maximum number of events to retain in memory. Older events are dropped.
   * @default 200
   */
  max?: number

  /**
   * Delay in milliseconds before the first reconnect attempt (exponential
   * backoff up to 30s thereafter). @default 1000
   */
  reconnectDelay?: number

  /**
   * Optional async supplier of a bearer token, called before each (re)connect.
   * When provided, the token is sent as `Authorization: Bearer <token>` instead
   * of relying on the ambient cookie session. Used by embedded apps that mint a
   * short-lived, route-scoped token via a facade; the dashboard page omits it
   * and authenticates with its session cookie as before. Returning a falsy
   * value falls back to the cookie session.
   */
  getToken?: () => Promise<string | null | undefined>
}

export interface UseConversationMonitorReturn {
  /** The accumulated monitor events in chronological order. */
  events: ConversationMonitorEvent[]
  /** Whether the stream is currently connected. */
  connected: boolean
  /** Whether the stream is attempting to connect. */
  connecting: boolean
  /** The current error, if any. */
  error: Error | null
  /** Clear the accumulated events. */
  clear: () => void
}

/**
 * Subscribe to a conversation's live monitor channel and accumulate its curated
 * lifecycle events (message, operation/tool-call, completion, error). Works
 * regardless of how the conversation is being executed (interactive, dispatched,
 * or via an integration). Read-only: subscribing never affects the conversation.
 *
 * @note uses POST + JSONL streaming (not EventSource) to mirror the rest of the
 * platform's channel subscriptions - the endpoint is POST (for historyLength)
 * and returns application/jsonl, parsed by the shared jsonl() helper.
 */
export default function useConversationMonitor(
  conversationId: string | undefined | null,
  options: UseConversationMonitorOptions = {}
): UseConversationMonitorReturn {
  const {
    enabled = true,
    historyLength = 50,
    max = 200,
    reconnectDelay = 1000,
    getToken,
  } = options

  const active = Boolean(enabled && conversationId)

  const [events, setEvents] = useState<ConversationMonitorEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const attemptsRef = useRef(0)
  const startStreamRef = useRef<(() => Promise<void>) | null>(null)

  // @note keep getToken in a ref so a changing function identity never restarts
  // the stream (it is read at connect time, not a dependency)
  const getTokenRef = useRef(getToken)

  useEffect(() => {
    getTokenRef.current = getToken
  }, [getToken])

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    // @note exponential backoff capped at 30s so a persistent outage doesn't busy-loop
    const delay = Math.min(
      reconnectDelay * Math.pow(2, attemptsRef.current),
      30000
    )

    attemptsRef.current += 1

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        void startStreamRef.current?.()
      }
    }, delay)
  }, [reconnectDelay])

  const startStream = useCallback(async () => {
    if (!isMountedRef.current || !conversationId) {
      return
    }

    // @note abort any in-flight stream before opening a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()

    abortControllerRef.current = abortController

    setConnecting(true)
    setError(null)

    try {
      // @note mint a fresh bearer token before every (re)connect when a supplier
      // is provided, so a short-lived route-scoped token never expires mid-stream
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/jsonl',
        'X-Requested-With': 'XMLHttpRequest',
      }

      if (getTokenRef.current) {
        const token = await getTokenRef.current()

        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
      }

      const response = await fetch(
        `/api/v1/conversation/${conversationId}/channel/subscribe`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            historyLength: historyLength > 0 ? historyLength : undefined,
          }),
          signal: abortController.signal,
        }
      )

      if (!isMountedRef.current) {
        return
      }

      if (!response.ok) {
        const errorText = await response.text()

        let errorMessage = `Conversation monitor subscription failed with status ${response.status}`

        try {
          errorMessage = JSON.parse(errorText).message || errorMessage
        } catch {
          // @note ignore parse errors and use the default message
        }

        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      setConnected(true)
      setConnecting(false)

      for await (const item of jsonl(
        response.body as ReadableStream<Uint8Array> & {
          [Symbol.asyncIterator](): AsyncIterator<Uint8Array>
        }
      )) {
        if (!isMountedRef.current || abortController.signal.aborted) {
          break
        }

        const streamItem = item as unknown as ConversationMonitorStreamItem

        if (streamItem.type === 'message' && streamItem.data) {
          // @note a real event arrived - reset the backoff
          attemptsRef.current = 0

          setEvents((prev) => [...prev, streamItem.data].slice(-max))
        }
      }

      // @note stream ended (server closed / gateway timeout) - reconnect unless we aborted
      if (isMountedRef.current && !abortController.signal.aborted) {
        setConnected(false)

        scheduleReconnect()
      }
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }

      // @note aborts are expected during cleanup / reconnect - swallow them
      if (
        err instanceof Error &&
        (err.name === 'AbortError' || err.message === 'AbortError')
      ) {
        return
      }

      setError(err instanceof Error ? err : new Error(String(err)))
      setConnected(false)
      setConnecting(false)

      scheduleReconnect()
    }
  }, [conversationId, historyLength, max, scheduleReconnect])

  useEffect(() => {
    startStreamRef.current = startStream
  }, [startStream])

  useEffect(() => {
    isMountedRef.current = true
    attemptsRef.current = 0

    if (active) {
      void startStream()
    }

    return () => {
      isMountedRef.current = false

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)

        reconnectTimeoutRef.current = null
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()

        abortControllerRef.current = null
      }
    }
  }, [active, startStream])

  return {
    events,
    connected,
    connecting,
    error,
    clear,
  }
}
