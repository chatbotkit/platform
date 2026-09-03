'use client'

import { useEffect, useState } from 'react'
import { IoIosOptions } from 'react-icons/io'

import useControlledState from '@/hooks/useControlledState'
import usePopup from '@/hooks/usePopup'

import CalendarInput from '@/components/CalendarInput'

import clsx from 'clsx'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const PRESETS = [
  { label: '1 day', ms: ONE_DAY_MS },
  { label: '1 week', ms: 7 * ONE_DAY_MS },
  { label: '30 days', ms: 30 * ONE_DAY_MS },
]

// @note the field name the popup submits its picked value under; the Apply
// action reads it back via formToData.
const POPUP_FIELD = 'expiresAtValue'

function ExpiresAtPopup({ currentValue }) {
  const [value, setValue] = useState(currentValue ?? null)

  return (
    <div className="space-y-4">
      <CalendarInput value={value} onChange={setValue} />
      <div className="flex flex-row flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">Quick set</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="default-button text-xs"
            onClick={() => setValue(Date.now() + preset.ms)}
          >
            +{preset.label}
          </button>
        ))}
      </div>
      {/* @note carries the picked value to the Apply action via formToData;
      number-or-null turns an empty value into an explicit null. */}
      <input
        type="hidden"
        name={POPUP_FIELD}
        data-type="number-or-null"
        value={value ?? ''}
        readOnly
      />
    </div>
  )
}

/**
 * Field for a resource's `expiresAt`. Mirrors ScheduleSelect: a read-only field
 * showing the current expiry (or "No expiry") plus an options button that opens
 * a popup with an inline calendar and quick presets. The submitted value (a
 * hidden field named `name`) is the absolute epoch-ms timestamp, or an empty
 * value that the `number-or-null` handler in `lib/form.ts` turns into an
 * explicit `null` so clearing overwrites a previously set expiry.
 */
export default function ExpiresAtInput({
  name = 'expiresAt',

  popupTitle = 'Expiry',

  defaultValue,
  value: _value,
  setValue: _setValue,

  className,
  wrapperClassName,
  containerClassName,

  disabled,

  ...props
}) {
  const [value, setValue] = useControlledState(
    defaultValue ?? null,
    _value,
    _setValue
  )

  // @note format the expiry in the viewer's locale only after mount, so the
  // server-rendered markup (which has no stable local timezone) matches the
  // client's first render and we avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { popup, openPopup, closePopup } = usePopup()

  function handleClick(event) {
    event.preventDefault()
    event.stopPropagation()

    if (disabled) {
      return
    }

    openPopup(<ExpiresAtPopup currentValue={value} />, {
      closePopupOnClickOutside: true,
      title: popupTitle,
      actions: {
        ...(value != null
          ? {
              'No expiry': {
                fn: () => {
                  setValue(null)
                  closePopup()
                },
              },
            }
          : {}),
        Apply: {
          default: true,
          fn: (data) => {
            setValue(data[POPUP_FIELD] ?? null)
            closePopup()
          },
        },
      },
    })
  }

  const display = mounted && value != null ? new Date(value).toLocaleString() : ''

  return (
    <div className={wrapperClassName}>
      {popup}
      <div
        className={clsx('flex flex-row gap-2 items-center', containerClassName)}
      >
        <input
          {...props}
          type="text"
          value={display}
          placeholder="No expiry"
          readOnly
          disabled={disabled}
          className={clsx('cursor-pointer', className)}
          onClick={handleClick}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label="Set expiry"
          title="Set expiry"
          disabled={disabled}
          onClick={handleClick}
        >
          <IoIosOptions
            className={clsx('h-5 w-5 default-link', { disabled: disabled })}
          />
        </button>
      </div>
      {/* @note the actual submitted value - an epoch-ms timestamp, or '' which
      the number-or-null handler in lib/form.ts turns into an explicit null so
      clearing overwrites a previously set expiry rather than leaving it. */}
      <input
        type="hidden"
        name={name}
        data-type="number-or-null"
        value={value ?? ''}
        readOnly
      />
    </div>
  )
}
