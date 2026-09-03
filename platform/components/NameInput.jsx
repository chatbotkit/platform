import { useEffect, useRef } from 'react'

import { isDbString } from '@/lib/db.string'

import useControllableInput from '@/hooks/useControllableInput'

export default function NameInput({
  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

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

    if (isDbString(value)) {
      ref.current.setCustomValidity('')
    } else {
      ref.current.setCustomValidity(`The name is too long.`)
    }
  }, [value])

  return <input {...props} value={value} onChange={onChange} ref={ref} />
}
