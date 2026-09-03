import { useEffect } from 'react'
import PinField, { usePinField } from 'react-pin-field'

import useControlledState from '@/hooks/useControlledState'

import clsx from 'clsx'

export default function PinInput({
  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  onComplete,

  name,

  length,

  autoFocus,

  className,

  containerClassName,

  pinClassName,

  children,

  ...props
}) {
  const [value, setValue] = useControlledState(_defaultValue, _value, _setValue)

  const handler = usePinField()

  // only update handler.value when value changes

  useEffect(() => {
    if (handler.value !== value) {
      handler.setValue(value ?? '')
    }
    // only depend on value and handler.setValue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // only update value when handler.value changes (from user input)

  useEffect(() => {
    if (handler.value !== value) {
      setValue(handler.value)
    }
    // only depend on handler.value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handler.value])

  return (
    <div {...props} className={clsx('pin-input', className)}>
      <input type="hidden" name={name} value={value || ''} />
      <div className={containerClassName}>
        <PinField
          className={pinClassName}
          handler={handler}
          length={length}
          onComplete={onComplete}
          autoFocus={autoFocus}
        />
      </div>
      {children}
    </div>
  )
}
