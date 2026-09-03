import type { HTMLAttributes } from 'react'
import type React from 'react'

import clsx from 'clsx'

export default function Ping({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    // @note overflow-visible is required so the animate-ping halo (scale(2))
    // isn't clipped when Ping sits inside a clipping container such as
    // .core-button / .core-button > * which force overflow-hidden.
    <span className={clsx('inline-flex overflow-visible', className)} {...props}>
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-600 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
      </span>
    </span>
  )
}
