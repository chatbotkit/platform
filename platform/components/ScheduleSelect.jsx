import { useEffect, useMemo, useState } from 'react'
import { IoIosOptions } from 'react-icons/io'

import { Schedule } from '@/prisma/enums'

import useControlledState from '@/hooks/useControlledState'
import useMagicDialog from '@/hooks/useMagicDialog'
import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'
import cronstrue from 'cronstrue'

function isPresetSchedule(value) {
  return Object.keys(Schedule).includes(value)
}

function describeCron(input) {
  if (!input) {
    return null
  }

  try {
    return cronstrue.toString(input, { use24HourTimeFormat: false })
  } catch {
    return null
  }
}

function SchedulePopup({ currentValue }) {
  const [input, setInput] = useState(
    isPresetSchedule(currentValue) ? '' : currentValue || ''
  )

  const description = useMemo(() => describeCron(input.trim()), [input])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Enter a custom cron expression or an ISO date string.
      </p>
      <input
        className="default-input w-full"
        type="text"
        name="schedule"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="*/5 * * * *"
        autoFocus
      />
      {description ? (
        <p className="text-xs text-neutral-500">{description}</p>
      ) : null}
    </div>
  )
}

export default function ScheduleSelect({
  wrapperClassName,
  containerClassName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  fair = false,
  allowCustom = false,
  disabled,

  ...props
}) {
  const [value, setValue] = useControlledState(
    _defaultValue || 'never',
    _value,
    _setValue
  )

  const scheduleOptions = Object.keys(Schedule).filter((schedule) => {
    if (
      fair &&
      [Schedule.quarterhourly, Schedule.halfhourly, Schedule.hourly].includes(
        schedule
      ) &&
      schedule !== value
    ) {
      return false
    }

    return true
  })

  const fallbackSchedule = scheduleOptions[0] || Schedule.never

  const [isCustom, setIsCustom] = useState(() => !isPresetSchedule(value))

  useEffect(() => {
    if (isPresetSchedule(value)) {
      setIsCustom(false)
    } else if (value) {
      setIsCustom(true)
    }
  }, [value])

  const { popup, openPopup, closePopup } = usePopup()

  const { dialog: magicDialog, open: magicDialogOpen } = useMagicDialog({
    promptId: '@schedule',

    title: 'Generate Schedule',

    children: (
      <p className="text-sm">
        Describe when you want the task to run and AI will generate the cron
        expression for you.
      </p>
    ),

    placeholder: 'every weekday at 9am',
  })

  function handleCustomClick(event) {
    event.preventDefault()
    event.stopPropagation()

    if (disabled) {
      return
    }

    openPopup(<SchedulePopup currentValue={value} />, {
      closePopupOnClickOutside: true,
      title: 'Custom Schedule',
      actions: {
        ...(isCustom
          ? {
              'Use Presets': {
                fn: () => {
                  setValue(fallbackSchedule)
                  closePopup()
                },
              },
            }
          : {}),
        Magic: {
          fn: () => {
            closePopup()

            magicDialogOpen({
              callback: (generated) => {
                const trimmed = generated.trim()

                if (trimmed) {
                  setValue(trimmed)
                }
              },
            })
          },
        },
        Apply: {
          default: true,
          fn: (data) => {
            const schedule = data.schedule?.trim()

            if (schedule) {
              setValue(schedule)
            }

            closePopup()
          },
        },
      },
    })
  }

  return (
    <div className={wrapperClassName}>
      {popup}
      {magicDialog}
      <div
        className={clsx('flex flex-row gap-2 items-center', containerClassName)}
      >
        {isCustom ? (
          <input
            {...props}
            type="text"
            value={value || ''}
            readOnly
            disabled={disabled}
            className={clsx('cursor-pointer', props.className)}
            onClick={handleCustomClick}
            spellCheck={false}
            autoComplete="off"
          />
        ) : (
          <select
            {...props}
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
          >
            {scheduleOptions.map((schedule) => {
              return (
                <option key={schedule} value={schedule}>
                  {schedule.replace(/_/g, ' ')}
                </option>
              )
            })}
          </select>
        )}
        {allowCustom ? (
          <button
            type="button"
            aria-label="Custom schedule"
            title="Custom schedule"
            disabled={disabled}
            onClick={handleCustomClick}
          >
            <IoIosOptions
              className={clsx('h-5 w-5 default-link', {
                disabled: disabled,
              })}
            />
          </button>
        ) : null}
      </div>
    </div>
  )
}
