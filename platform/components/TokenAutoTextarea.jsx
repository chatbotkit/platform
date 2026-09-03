import { forwardRef, useEffect, useState } from 'react'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'

import useControllableInput from '@/hooks/useControllableInput'
import useDebounce from '@/hooks/useDebounce'
import useTokenCount from '@/hooks/useTokenCount'

import clsx from 'clsx'

const TokenAutoTextarea = forwardRef(function TokenAutoTextarea(
  {
    maxTokens = Infinity, // by default maxTokens is effectively disabled

    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,

    autoTextareaAs,

    hideZero,

    onLengthChange,

    className,
    wrapperClassName,

    children,

    ...props
  },
  forwardedRef
) {
  const [value, onChange] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  const debouncedValue = useDebounce(value, 1000)

  const length = useTokenCount(debouncedValue)

  useEffect(() => {
    if (onLengthChange) {
      onLengthChange(length)
    }
  }, [length, onLengthChange])

  const [spanClassName, setSpanClassName] = useState('')

  useEffect(() => {
    setSpanClassName(
      clsx({
        // Note that none of these calculations will work unless maxTokens is
        // actually set. This is why we set the default value to Infinity.

        'bg-red-200 text-black': length > maxTokens,
        'bg-orange-200 text-black':
          length >= 0.8 * maxTokens && length <= maxTokens,
        'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500':
          length < 0.8 * maxTokens,
      })
    )
  }, [maxTokens, length])

  const showExtra = !!children || length > 0 || !hideZero

  return (
    <AdvancedAutoTextarea
      {...props}
      className={clsx('!pb-10 !scroll-pb-10', className)}
      wrapperClassName={wrapperClassName}
      value={value}
      onChange={onChange}
      autoTextareaAs={autoTextareaAs}
      ref={forwardedRef}
    >
      {showExtra ? (
        <>
          {length > 0 || !hideZero ? (
            <div className="relative group/tooltip flex justify-center cursor-help select-none">
              <span
                className={clsx(
                  'flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2',
                  spanClassName
                )}
              >
                <div className="truncate">{length || ' 0 '}</div>
              </span>
              <span className="tooltip below w-44">Number of tokens used</span>
            </div>
          ) : null}
          {children}
        </>
      ) : null}
    </AdvancedAutoTextarea>
  )
})

export default TokenAutoTextarea
