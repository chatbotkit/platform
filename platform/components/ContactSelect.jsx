import { useState } from 'react'
import { BiLinkExternal } from 'react-icons/bi'

import Link from '@/components/Link'

import clsx from 'clsx'

export default function ContactSelect({
  wrapperClassName,
  containerClassName,

  defaultValue,
  value: _value,
  onChange,

  disabled,

  ...props
}) {
  const [value, setValue] = useState(_value || defaultValue || '')

  function handleChange(event) {
    if (disabled) {
      return
    }

    setValue(event.target.value)

    if (onChange) {
      onChange(event)
    }
  }

  return (
    <div className={wrapperClassName}>
      <div
        className={clsx('flex flex-row gap-2 items-center', containerClassName)}
      >
        <input
          {...props}
          type="text"
          value={value}
          placeholder="Enter contact ID..."
          onChange={handleChange}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
        />
        {value ? (
          <Link href={`/contacts/${value}`} target="_blank">
            <BiLinkExternal
              className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
