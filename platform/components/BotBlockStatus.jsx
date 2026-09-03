import { useCallback, useEffect, useState } from 'react'

import { formatDuration } from '@chatbotkit-dev/time'

import useFetch from '@/hooks/useFetch'

/**
 * Shows whether a bot is currently blocked (e.g. by a usage policy) and lets the
 * owner lift the block early. Time-limited blocks expire on their own, so this is
 * only needed to re-enable a bot before its TTL elapses.
 */
export default function BotBlockStatus({ botId }) {
  const [block, setBlock] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const { fetch, loading } = useFetch()

  const load = useCallback(async () => {
    const { data, error } = await fetch(`/api/v1/bot/${botId}/access/fetch`)

    if (!error) {
      setBlock(data?.block ?? null)
    }

    setLoaded(true)
  }, [fetch, botId])

  useEffect(() => {
    load()
  }, [load])

  async function handleUnblock() {
    const { error } = await fetch(`/api/v1/bot/${botId}/access/unblock`, {
      data: {},

      successMessage: 'Bot unblocked.',
      failureMessage: true,
    })

    if (!error) {
      setBlock(null)
    }
  }

  if (!loaded) {
    return <p className="text-sm text-gray-500">Checking block status…</p>
  }

  if (!block) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <span>This bot is active and not blocked.</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        <span>
          This bot is blocked
          {block.ttl ? ` - ${formatDuration(block.ttl * 1000)} remaining` : ''}.
        </span>
      </div>
      {block.reason ? (
        <p className="text-sm text-gray-500">{block.reason}</p>
      ) : null}
      <button
        type="button"
        className="default-button"
        onClick={handleUnblock}
        disabled={loading}
      >
        Unblock Bot
      </button>
    </div>
  )
}
