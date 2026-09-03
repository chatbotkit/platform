import { useState } from 'react'

import useControlledState from '@/hooks/useControlledState'

export default function RevealToken({
  defaultToken: _defaultToken = '',
  token: _token,
  setToken: _setToken,

  onChange: _onChange,
  onFocus: _onFocus,
  onBlur: _onBlur,

  ...props
}) {
  const [token, setToken] = useControlledState(_defaultToken, _token, _setToken)

  const [visible, setVisible] = useState(false)

  function handleOnChange(event) {
    if (_onChange) {
      _onChange(event)
    }

    setToken(event.target.value)
  }

  function handleOnFocus() {
    if (_onFocus) {
      _onFocus()
    }

    setVisible(true)
  }

  function handleOnBlur() {
    if (_onBlur) {
      _onBlur()
    }

    setVisible(false)
  }

  return (
    <input
      {...props}
      type={visible ? 'text' : 'password'}
      value={token || ''}
      onChange={handleOnChange}
      onFocus={handleOnFocus}
      onBlur={handleOnBlur}
      // disable filling in password managers
      autoComplete="off"
      data-lpignore="true"
    />
  )
}
