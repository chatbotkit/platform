import { useMemo } from 'react'

import { Trigger } from '@/prisma/enums'

import useControlledState from '@/hooks/useControlledState'
import useDebounce from '@/hooks/useDebounce'

export default function TriggerSelect({
  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  ...props
}) {
  const [value, setValue] = useControlledState(
    _defaultValue || 'never',
    _value,
    _setValue
  )

  const debouncedValue = useDebounce(value, 500)

  const isCustom = useMemo(() => {
    return !Object.keys(Trigger).includes(debouncedValue)
  }, [debouncedValue])

  return isCustom ? (
    <input
      {...props}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      spellCheck={false}
      autoComplete="off"
    />
  ) : (
    <select
      {...props}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    >
      {Object.keys(Trigger).map((trigger) => {
        return (
          <option key={trigger} value={trigger}>
            {trigger.replace(/_/g, ' ')}
          </option>
        )
      })}
    </select>
  )
}
