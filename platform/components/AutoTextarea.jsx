import { forwardRef, useImperativeHandle, useRef } from 'react'

import AT from '@chatbotkit/react/components/AutoTextarea'

import clsx from 'clsx'

export function AutoTextarea({ className, ...props }, forwardedRef) {
  const localRef = useRef(null)

  useImperativeHandle(forwardedRef, () => localRef.current)

  return (
    <AT
      {...props}
      className={clsx(
        'min-h-[5rem]', // @note normally textareas have some minimum height hence why we need this
        'resize-none overflow-hidden w-full',
        className
      )}
      ref={localRef}
    />
  )
}

export default forwardRef(AutoTextarea)
