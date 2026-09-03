import type React from 'react'

import clsx from 'clsx'

interface ForwardButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Additional CSS classes to apply */
  className?: string
  /** Button content */
  children?: React.ReactNode
}

export default function ForwardButton({
  className,
  children,
  ...props
}: ForwardButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      {...props}
      className={clsx('relative group', className)}
    >
      <span className="mr-6">{children}</span>
      <span className="absolute right-5 group-hover:translate-x-1 transition-all">
        &rarr;
      </span>
    </button>
  )
}
