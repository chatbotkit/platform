import useControlledState from '@/hooks/useControlledState'

import { Switch } from '@headlessui/react'

import clsx from 'clsx'

export default function Toggle({
  caption,

  defaultChecked: _defaultChecked = false,
  checked: _checked,
  setChecked: _setChecked,

  children,

  disabled,

  ...props
}) {
  const [checked, setChecked] = useControlledState(
    _defaultChecked,
    _checked,
    _setChecked
  )

  const value = checked ? 'on' : 'off'

  function onChange(checked) {
    setChecked(checked)
  }

  function onToggle(event) {
    event.preventDefault()

    setChecked(!checked)
  }

  return (
    <Switch.Group className="flex flex-row gap-2 items-center" as="div">
      <Switch
        {...props}
        className={clsx(
          checked && !disabled ? 'auto-bg-black' : 'auto-bg-gray-200',

          disabled ? 'cursor-not-allowed' : 'cursor-pointer',

          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent',
          'focus:outline-none focus:ring-2 focus:ring-black dark:ring-white focus:ring-offset-2',

          'transition-all duration-200 ease-in-out',

          'shadow-sm'
        )}
        value={value}
        onChange={onChange}
        checked={checked}
        disabled={disabled}
      >
        <span className="sr-only">{caption}</span>
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none',

            checked ? 'translate-x-5' : 'translate-x-0',

            'inline-block h-5 w-5',
            'transform',
            'rounded-full',
            'bg-white dark:bg-gray-500',
            'transition duration-200 ease-in-out'
          )}
        />
        {!checked && props.name ? (
          <input
            className="hidden"
            type="checkbox"
            name={props.name}
            value={value}
            onChange={onChange}
            readOnly
            hidden
          />
        ) : null}
      </Switch>
      {children ? (
        <div className="cursor-pointer" onClick={onToggle}>
          {children}
        </div>
      ) : null}
    </Switch.Group>
  )
}
