import { forwardRef, useImperativeHandle, useRef } from 'react'

import AutoTextarea from '@/components/AutoTextarea'

import useControlledState from '@/hooks/useControlledState'

import clsx from 'clsx'

export function RevealTextarea(
  {
    defaultToken: _defaultToken = '',
    token: _token,
    setToken: _setToken,

    onChange: _onChange,

    className,

    ...props
  },
  forwardedRef
) {
  const localRef = useRef(null)

  useImperativeHandle(forwardedRef, () => localRef.current)

  const [token, setToken] = useControlledState(_defaultToken, _token, _setToken)

  function handleOnChange(event) {
    if (_onChange) {
      _onChange(event)
    }

    setToken(event.target.value)
  }

  return (
    <AutoTextarea
      {...props}
      ref={localRef}
      className={clsx('font-mono break-all', className)}
      value={token || ''}
      onChange={handleOnChange}
      // disable filling in password managers
      autoComplete="off"
      spellCheck={false}
    />
  )
}

export default forwardRef(RevealTextarea)
