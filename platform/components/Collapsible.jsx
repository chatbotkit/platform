import { forwardRef, useRef } from 'react'

import Component from '@/components/Component'

import useScrollHeight from '@/hooks/useScrollHeight'

// @note there is another component similar to this one called `AutoGrow`

export function Collapsible(
  {
    as = 'div',

    style,

    innerClassName,

    children,

    disabled,

    ...props
  },
  forwardedRef
) {
  const monitoredRef = useRef()

  const height = useScrollHeight(monitoredRef, disabled)

  return (
    <Component
      {...props}
      ref={forwardedRef}
      as={as}
      style={{
        ...style,

        ...(disabled
          ? null
          : {
              height: typeof height === 'number' ? `${height}px` : height,
            }),

        ...(style && 'height' in style && style.height != null
          ? { height: style.height }
          : {}),
      }}
      disabled={disabled}
    >
      <div className={innerClassName} ref={monitoredRef}>
        {children}
      </div>
    </Component>
  )
}

export default forwardRef(Collapsible)
