'use client'

import { formatDuration } from '@chatbotkit-dev/time'

import TooltipButton from '@/components/TooltipButton'

import useBotBlock from '@/hooks/useBotBlock'

/**
 * A compact tag rendered on a bot node in the blueprint designer while the bot is
 * blocked (e.g. by a usage policy). Renders nothing when the bot is not blocked.
 * The reason and remaining time are surfaced in a tooltip; the block itself is
 * lifted from the bot's configurator panel.
 *
 * @param {object} props
 * @param {string} props.botId
 */
export default function BotBlockTag({ botId }) {
  const { block } = useBotBlock(botId)

  if (!block) {
    return null
  }

  const remaining = block.ttl
    ? ` - ${formatDuration(block.ttl * 1000)} remaining`
    : ''

  return (
    <TooltipButton
      as="span"
      tooltip={`${
        block.reason || 'This bot is temporarily disabled.'
      }${remaining}`}
    >
      <span className="tag error text-xxs min-w-0 max-w-full shrink">
        blocked
      </span>
    </TooltipButton>
  )
}
