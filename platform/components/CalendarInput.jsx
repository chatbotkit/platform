'use client'

import { useEffect, useState } from 'react'
import { IoChevronBack, IoChevronForward } from 'react-icons/io5'

import clsx from 'clsx'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// @note default time-of-day for a freshly-picked day when there is no prior
// selection - end of day reads naturally for an "expires on this day" intent.
const DEFAULT_HOUR = 23
const DEFAULT_MINUTE = 59

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// @note the 6x7 grid of dates covering a month view - the leading/trailing cells
// spill into the adjacent months. Native Date arithmetic handles the rollover.
export function buildMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay()

  return Array.from(
    { length: 42 },
    (_, i) => new Date(year, month, 1 - startWeekday + i)
  )
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * A controlled inline calendar view. `value` is an absolute epoch-millisecond
 * timestamp (or `null` for no selection); `onChange` is called with the new
 * epoch-ms timestamp whenever a day or the time is picked. It renders the
 * calendar directly - it is not a text field or a select.
 */
export default function CalendarInput({ value, onChange, className }) {
  const selected = value != null ? new Date(value) : null

  const [view, setView] = useState(() => {
    const base = selected ?? new Date()

    return { year: base.getFullYear(), month: base.getMonth() }
  })

  const [time, setTime] = useState(() => ({
    hour: selected ? selected.getHours() : DEFAULT_HOUR,
    minute: selected ? selected.getMinutes() : DEFAULT_MINUTE,
  }))

  // @note follow the controlled value when it changes from outside the grid
  // (e.g. a quick preset) so the picked day becomes visible and the time
  // reflects it. Manual month navigation moves `view` without touching `value`,
  // so it is preserved (this only runs when `value` itself changes).
  useEffect(() => {
    if (value == null) {
      return
    }

    const date = new Date(value)

    setView({ year: date.getFullYear(), month: date.getMonth() })
    setTime({ hour: date.getHours(), minute: date.getMinutes() })
  }, [value])

  const cells = buildMonthGrid(view.year, view.month)

  const today = new Date()

  function goToMonth(delta) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)

      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function selectDay(day) {
    onChange?.(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        time.hour,
        time.minute
      ).getTime()
    )
  }

  function changeTime(next) {
    setTime(next)

    if (selected) {
      onChange?.(
        new Date(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
          next.hour,
          next.minute
        ).getTime()
      )
    }
  }

  return (
    <div className={clsx('select-none', className)}>
      {/* month navigation */}
      <div className="flex flex-row items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="default-link p-1"
          onClick={() => goToMonth(-1)}
        >
          <IoChevronBack className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium">
          {MONTHS[view.month]} {view.year}
        </div>
        <button
          type="button"
          aria-label="Next month"
          className="default-link p-1"
          onClick={() => goToMonth(1)}
        >
          <IoChevronForward className="h-4 w-4" />
        </button>
      </div>

      {/* weekday header */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-xs font-medium text-neutral-400"
          >
            {weekday}
          </div>
        ))}
      </div>

      {/* day grid */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const inMonth = day.getMonth() === view.month
          const isSelected = selected && isSameDay(day, selected)
          const isToday = isSameDay(day, today)

          return (
            <button
              key={day.getTime()}
              type="button"
              aria-label={day.toDateString()}
              aria-pressed={!!isSelected}
              onClick={() => selectDay(day)}
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                {
                  'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900':
                    isSelected,
                  'hover:bg-neutral-100 dark:hover:bg-neutral-800': !isSelected,
                  'text-neutral-400 dark:text-neutral-600':
                    inMonth === false && !isSelected,
                  'ring-1 ring-neutral-300 dark:ring-neutral-600':
                    isToday && !isSelected,
                }
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      {/* time */}
      <div className="mt-3 flex flex-row items-center gap-2">
        <span className="text-sm text-neutral-500">Time</span>
        <select
          className="default-input appearance-none"
          aria-label="Hour"
          value={time.hour}
          onChange={(event) =>
            changeTime({ ...time, hour: Number(event.target.value) })
          }
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {pad(h)}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          className="default-input appearance-none"
          aria-label="Minute"
          value={time.minute}
          onChange={(event) =>
            changeTime({ ...time, minute: Number(event.target.value) })
          }
        >
          {Array.from({ length: 60 }, (_, m) => (
            <option key={m} value={m}>
              {pad(m)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
