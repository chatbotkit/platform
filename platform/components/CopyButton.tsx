import type { MouseEvent } from 'react'

import toast from '@/lib/toast'

export async function copyTextToClipboard(
  text: string | (() => string),
  message?: string
) {
  try {
    await window.navigator.clipboard.writeText(
      typeof text === 'function' ? text() : text
    )

    if (message) {
      toast.success(message)
    }
  } catch {
    // @note clipboard API may be blocked by permissions policy

    toast.error('Failed to copy to clipboard')
  }
}

export default function CopyButton({
  text,

  message = 'Copied to your clipboard',

  onClick,

  ...props
}: {
  text: string | (() => string)

  message?: string

  onClick?: (event: MouseEvent<HTMLButtonElement>) => void

  [key: string]: unknown
}) {
  function handleOnClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    void copyTextToClipboard(text, message)

    if (onClick) {
      onClick(event)
    }
  }

  return <button type="button" {...props} onClick={handleOnClick} />
}
