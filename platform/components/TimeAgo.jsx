import { getShortDateTime, timeAgo } from '@chatbotkit-dev/time'

import TooltipButton from '@/components/TooltipButton'

export default function TimeAgo({ time, tooltip = true, ...props }) {
  // @note handle invalid time values to prevent RangeError

  const isValidTime = time != null && !isNaN(new Date(time).getTime())
  const dateTimeValue = isValidTime ? new Date(time).toISOString() : ''

  return (
    <TooltipButton
      as="span"
      transitionStyles="scale"
      {...props}
      tooltip={
        tooltip && isValidTime ? (
          <span>{getShortDateTime(time)}</span>
        ) : undefined
      }
    >
      <time
        dateTime={dateTimeValue}
        suppressHydrationWarning // @note suppressHydrationWarning needed because date formatting differs between server (Node.js) and client (browser) due to timezone/locale differences
      >
        {isValidTime ? timeAgo(time) : '-'}
      </time>
    </TooltipButton>
  )
}
