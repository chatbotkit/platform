import { forwardRef } from 'react'

import AutoTextarea from '@/components/AutoTextarea'
import Component from '@/components/Component'

import clsx from 'clsx'

const AdvancedAutoTextarea = forwardRef(function AdvancedAutoTextarea(
  {
    className,

    wrapperClassName,

    autoTextareaAs = AutoTextarea,

    floatingExtra = false,

    children,

    ...props
  },
  forwardedRef
) {
  const showExtra = !!children

  return (
    <div className={clsx('relative w-full', wrapperClassName)}>
      <Component
        {...props}
        className={clsx(
          'w-full',
          {
            '!pb-10 !scroll-pb-10': showExtra,
          },
          className
        )}
        as={autoTextareaAs}
        ref={forwardedRef}
      />
      {showExtra ? (
        // @note the z-30 is important particularly on the InstructionInput
        // where the text highlighter is z-20 and the buttons need to be on top
        <div
          className={clsx(
            {
              absolute: !floatingExtra,
              'sticky right-0': floatingExtra,
            },
            'z-30 bottom-3.5 right-2 flex flex-row gap-1 justify-end items-center pointer-events-none'
          )}
        >
          <div className="flex flex-row gap-1 justify-end items-center pointer-events-auto">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  )
})

export default AdvancedAutoTextarea
