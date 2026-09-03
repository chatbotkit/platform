'use client'

import { useCallback, useEffect, useReducer } from 'react'

import useFetch from '@/hooks/useFetch'

/**
 * A bot's block state (e.g. from a usage policy) lives in Redis and is surfaced -
 * and lifted - from more than one place at once: the node tag on the blueprint
 * canvas and the bot's configurator panel both read it, and both are mounted
 * while a bot is being configured.
 *
 * To avoid every consumer firing its own request, this module keeps a single
 * shared store keyed by botId. Consumers read the same cached value, concurrent
 * loads are deduped into one in-flight request, and a mutation (unblock) updates
 * the store so every consumer re-renders in sync. It is intentionally not a
 * localStorage/TTL cache (`useCache`) because the value is ephemeral runtime
 * state rather than a cacheable query result.
 */
const EMPTY_ENTRY = { block: null, loaded: false }
const RESOLVED_ENTRY = { block: null, loaded: true }

const store = new Map() // botId -> { block, loaded }
const inflight = new Map() // botId -> Promise
const listeners = new Map() // botId -> Set<listener>

function readEntry(botId) {
  return store.get(botId) ?? EMPTY_ENTRY
}

function writeEntry(botId, entry) {
  store.set(botId, entry)

  listeners.get(botId)?.forEach((listener) => listener())
}

function subscribe(botId, listener) {
  let set = listeners.get(botId)

  if (!set) {
    set = new Set()

    listeners.set(botId, set)
  }

  set.add(listener)

  return () => {
    set.delete(listener)

    if (!set.size) {
      listeners.delete(botId)
    }
  }
}

/**
 * Fetch a bot's block into the shared store. Deduped: a concurrent call for the
 * same botId reuses the in-flight request, and (unless `force`) an already-loaded
 * entry is served from the store without a new request.
 */
function loadBlock(botId, fetch, { force = false } = {}) {
  if (!botId) {
    return Promise.resolve()
  }

  if (inflight.has(botId)) {
    return inflight.get(botId)
  }

  if (!force && store.get(botId)?.loaded) {
    return Promise.resolve()
  }

  const promise = (async () => {
    try {
      const { data, error } =
        (await fetch(`/api/v1/bot/${botId}/access/fetch`)) || {}

      if (!error) {
        writeEntry(botId, { block: data?.block ?? null, loaded: true })
      } else {
        // keep the last known block on a transient error, just mark it loaded
        writeEntry(botId, { block: readEntry(botId).block, loaded: true })
      }
    } finally {
      inflight.delete(botId)
    }
  })()

  inflight.set(botId, promise)

  return promise
}

/**
 * Track whether a bot is currently blocked (e.g. by a usage policy) and expose a
 * way to lift the block early. Time-limited blocks expire on their own via TTL,
 * so unblocking is only needed to re-enable a bot before its TTL elapses.
 *
 * Pass a falsy `botId` (e.g. for an unsaved node that has no id yet) to disable
 * fetching; the hook then reports "not blocked" without hitting the network.
 *
 * @param {string|null|undefined} botId
 */
export default function useBotBlock(botId) {
  const { fetch, loading } = useFetch()

  const [, rerender] = useReducer((n) => n + 1, 0)

  // re-render whenever the shared store entry for this botId changes (another
  // consumer loaded it, or an unblock cleared it)
  useEffect(() => {
    if (!botId) {
      return
    }

    return subscribe(botId, rerender)
  }, [botId])

  // populate the store once; deduped so co-mounted consumers share one request
  useEffect(() => {
    loadBlock(botId, fetch)
  }, [botId, fetch])

  const reload = useCallback(
    () => loadBlock(botId, fetch, { force: true }),
    [botId, fetch]
  )

  const unblock = useCallback(async () => {
    if (!botId) {
      return { error: undefined }
    }

    const result = await fetch(`/api/v1/bot/${botId}/access/unblock`, {
      data: {},

      successMessage: 'Bot unblocked.',
      failureMessage: true,
    })

    if (!result?.error) {
      writeEntry(botId, { block: null, loaded: true })
    }

    return result || {}
  }, [botId, fetch])

  const entry = botId ? readEntry(botId) : RESOLVED_ENTRY

  return { block: entry.block, loaded: entry.loaded, loading, unblock, reload }
}
