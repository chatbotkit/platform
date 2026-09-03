import { useCallback, useEffect, useState } from 'react'

import { formatDuration } from '@chatbotkit-dev/time'

import useFetch from '@/hooks/useFetch'

import pluralize from 'pluralize'

/**
 * Shows the block(s) a usage policy is currently holding and lets the owner clear
 * them. A bot-scoped policy reports the targeted bot; a global policy lists every
 * bot it has blocked. Clearing also resets the policy's rolling window so the bot
 * is not immediately re-blocked by a counter that is still over the threshold.
 */
export default function PolicyBlockStatus({ policyId }) {
  const [status, setStatus] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const { fetch, loading } = useFetch()

  const load = useCallback(async () => {
    const { data, error } = await fetch(`/api/v1/policy/${policyId}/block/list`)

    if (!error) {
      setStatus(data ?? null)
    }

    setLoaded(true)
  }, [fetch, policyId])

  useEffect(() => {
    load()
  }, [load])

  async function handleClear() {
    const { error } = await fetch(`/api/v1/policy/${policyId}/block/clear`, {
      data: {},

      successMessage: 'Block cleared.',
      failureMessage: true,
    })

    if (!error) {
      await load()
    }
  }

  if (!loaded) {
    return <p className="text-sm text-gray-500">Checking block status…</p>
  }

  const blockedBotIds = status?.blockedBotIds ?? []

  const count = blockedBotIds.length

  if (!count) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <span>No bots are currently blocked by this policy.</span>
      </div>
    )
  }

  const isBotScope = status.scope === 'bot'

  const label = isBotScope
    ? `The targeted bot is blocked by this policy${
        status.block?.ttl
          ? ` - ${formatDuration(status.block.ttl * 1000)} remaining`
          : ''
      }.`
    : `${pluralize('bot', count, true)} currently blocked by this policy.`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        <span>{label}</span>
      </div>
      {isBotScope && status.block?.reason ? (
        <p className="text-sm text-gray-500">{status.block.reason}</p>
      ) : null}
      <button
        type="button"
        className="default-button"
        onClick={handleClear}
        disabled={loading}
      >
        {isBotScope ? 'Clear Block' : 'Clear All Blocks'}
      </button>
    </div>
  )
}
