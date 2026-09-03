import { useMemo, useState } from 'react'

import List from '@/components/List'

import useControlledState from '@/hooks/useControlledState'
import useDebounce from '@/hooks/useDebounce'
import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
]

function getSupportedTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone')
    }
  } catch {
    // pass
  }

  return FALLBACK_TIMEZONES
}

function getResolvedTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatTimezoneLabel(timezone) {
  return timezone.replace(/_/g, ' ')
}

function getTimezoneTitle(timezone) {
  const parts = timezone.split('/')

  return formatTimezoneLabel(parts[parts.length - 1] || timezone)
}

function getTimezoneDescription(timezone) {
  const parts = timezone.split('/')

  if (parts.length <= 1) {
    return null
  }

  return parts.slice(0, -1).map(formatTimezoneLabel).join(' / ')
}

function getTimezoneOffset(timezone) {
  try {
    const value = new Date().toLocaleTimeString('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })

    const match = value.match(/(?:GMT|UTC)((?:[+-]\d{1,2})(?::(\d{2}))?)?/)

    if (!match) {
      return null
    }

    const hours = match[1]
    const minutes = match[2]

    if (!hours) {
      return 'GMT+0'
    }

    return minutes ? `GMT${hours}:${minutes}` : `GMT${hours}`
  } catch {
    return null
  }
}

function matchesTimezone(timezone, searchLower) {
  return [
    timezone,
    formatTimezoneLabel(timezone),
    getTimezoneTitle(timezone),
    getTimezoneDescription(timezone),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(searchLower)
}

function TimezoneList({
  title,
  timezones,
  currentTimezone,
  resolvedTimezone,
  recommendedTimezones = [],
  onSelect,
}) {
  return timezones.length ? (
    <List title={title} emptyMessage="No timezones found.">
      {timezones.map((timezone) => {
        const isRecommended = recommendedTimezones.includes(timezone)
        const offset = getTimezoneOffset(timezone)

        return (
          <List.Item
            key={timezone}
            selected={timezone === currentTimezone}
            title={getTimezoneTitle(timezone)}
            body={getTimezoneDescription(timezone)}
            trailing={offset ? <span className="tag">{offset}</span> : null}
            onClick={() => onSelect(timezone)}
          >
            {isRecommended ? <span className="tag">Recommended</span> : null}
            {timezone === resolvedTimezone ? (
              <span className="tag">Current region</span>
            ) : null}
          </List.Item>
        )
      })}
    </List>
  ) : null
}

function TimezonePopup({ currentTimezone, timezones, onSelect }) {
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const resolvedTimezone = useMemo(() => getResolvedTimezone(), [])

  const recommendedTimezones = useMemo(() => {
    return Array.from(
      new Set([resolvedTimezone, currentTimezone, 'UTC'].filter(Boolean))
    ).filter((timezone) => timezones.includes(timezone))
  }, [currentTimezone, resolvedTimezone, timezones])

  const filteredTimezones = useMemo(() => {
    if (!debouncedSearch) {
      return timezones
    }

    const searchLower = debouncedSearch.toLowerCase()

    return timezones.filter((timezone) => {
      return matchesTimezone(timezone, searchLower)
    })
  }, [debouncedSearch, timezones])

  const filteredRecommendedTimezones = useMemo(() => {
    if (!debouncedSearch) {
      return recommendedTimezones
    }

    const searchLower = debouncedSearch.toLowerCase()

    return recommendedTimezones.filter((timezone) => {
      return matchesTimezone(timezone, searchLower)
    })
  }, [debouncedSearch, recommendedTimezones])

  const filteredRemainingTimezones = useMemo(() => {
    return filteredTimezones.filter((timezone) => {
      return !filteredRecommendedTimezones.includes(timezone)
    })
  }, [filteredRecommendedTimezones, filteredTimezones])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a timezone for schedule evaluation. Start with a recommended
        option or search the full IANA timezone list.
      </p>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search timezones..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        autoFocus
      />
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto pr-1">
        <div className="space-y-5">
          {filteredRecommendedTimezones.length ? (
            <TimezoneList
              title="Recommended"
              timezones={filteredRecommendedTimezones}
              currentTimezone={currentTimezone}
              resolvedTimezone={resolvedTimezone}
              recommendedTimezones={recommendedTimezones}
              onSelect={onSelect}
            />
          ) : null}
          {filteredRemainingTimezones.length ? (
            <TimezoneList
              title="All Timezones"
              timezones={filteredRemainingTimezones}
              currentTimezone={currentTimezone}
              resolvedTimezone={resolvedTimezone}
              recommendedTimezones={recommendedTimezones}
              onSelect={onSelect}
            />
          ) : null}
          {!filteredRecommendedTimezones.length &&
          !filteredRemainingTimezones.length ? (
            <p className="text-sm auto-text-gray-500 px-1">
              No timezones found.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function TimezoneSelect({
  wrapperClassName,

  defaultValue,
  value: _value,
  setValue: _setValue,

  name,
  disabled,
  className,

  ...props
}) {
  const timezones = useMemo(() => {
    return Array.from(new Set(['UTC', ...getSupportedTimezones()])).sort()
  }, [])

  const [value, setValue] = useControlledState(
    defaultValue ?? getResolvedTimezone(),
    _value,
    _setValue
  )

  const normalizedValue = value || 'UTC'

  const { popup, openPopup, closePopup } = usePopup({})

  function handleSelect(nextValue) {
    setValue(nextValue)
    closePopup()
  }

  function handleOpenPopup() {
    if (disabled) {
      return
    }

    openPopup(
      <TimezonePopup
        currentTimezone={normalizedValue}
        timezones={timezones}
        onSelect={handleSelect}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Timezone',
        dialogClassName: 'sm:max-w-2xl',
      }
    )
  }

  return (
    <div className={wrapperClassName}>
      {popup}
      <input name={name} type="hidden" value={normalizedValue} readOnly />
      <input
        {...props}
        type="text"
        value={normalizedValue}
        onClick={handleOpenPopup}
        readOnly
        disabled={disabled}
        className={clsx(
          'cursor-pointer',
          disabled && 'cursor-not-allowed',
          className
        )}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}
