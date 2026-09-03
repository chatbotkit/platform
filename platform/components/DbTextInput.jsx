import { useEffect, useRef } from 'react'

import { isDbText } from '@/lib/db.string'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import Component from '@/components/Component'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useControllableInput from '@/hooks/useControllableInput'

import clsx from 'clsx'

export default function DbTextInput({
  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  className,
  wrapperClassName,
  containerClassName,
  textareaWrapperClassName,

  countTokens,

  ...props
}) {
  const ref = useRef(null)

  const [value, onChange] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  useEffect(() => {
    if (!ref.current) {
      return
    }

    if (!value) {
      ref.current.setCustomValidity('')

      return
    }

    if (isDbText(value)) {
      ref.current.setCustomValidity('')
    } else {
      ref.current.setCustomValidity(`The field is too long.`)
    }
  }, [value])

  return (
    <div className={wrapperClassName}>
      <div className={clsx('relative', containerClassName)}>
        <Component
          {...props}
          className={clsx(
            'max-h-96 !overflow-auto', // @note large editable areas are kind of funky to edit so we need to constrain the height

            className
          )}
          wrapperClassName={textareaWrapperClassName}
          value={value}
          onChange={onChange}
          as={countTokens ? TokenAutoTextarea : AdvancedAutoTextarea}
          ref={ref}
        />
      </div>
    </div>
  )
}
