import { formatDuration } from '@chatbotkit-dev/time'

import pluralize from 'pluralize'

export default function DurationSelect({
  minutesOptions = [30, 45, 60, 90],

  hoursOptions = [2, 4, 6, 12, 24],

  daysOptions = [2, 3, 4, 5, 6],

  weeksOptions = [1, 2, 3, 4],

  maximum,

  defaultCaption = 'automatic',

  // @note when `nullable` is set, the default ("automatic") option submits an
  // empty value that the form serializer resolves to an explicit `null` (see
  // data-type="number-or-null" in lib/form.ts), rather than the literal `0`.
  // This lets the field reset back to its automatic default on both create and
  // update. Without it the default option submits `0`, kept for the consumers
  // that treat `0` as their automatic sentinel.
  nullable = false,

  allowNoSession = nullable,

  defaultValue,
  value,

  ...props
}) {
  const defaultOptionValue = nullable ? '' : 0

  const isAllowed = (duration) => maximum == null || duration <= maximum

  const minutesMap = Object.fromEntries(
    minutesOptions
      .map((minutes) => {
        return [minutes * 60 * 1000, minutes]
      })
      .filter(([duration]) => isAllowed(duration))
  )

  const hoursMap = Object.fromEntries(
    hoursOptions
      .map((hours) => {
        return [hours * 60 * 60 * 1000, hours]
      })
      .filter(([duration]) => isAllowed(duration))
  )

  const daysMap = Object.fromEntries(
    daysOptions
      .map((days) => {
        return [days * 24 * 60 * 60 * 1000, days]
      })
      .filter(([duration]) => isAllowed(duration))
  )

  const weeksMap = Object.fromEntries(
    weeksOptions
      .map((weeks) => {
        return [weeks * 7 * 24 * 60 * 60 * 1000, weeks]
      })
      .filter(([duration]) => isAllowed(duration))
  )

  const val = value || defaultValue

  return (
    <select
      {...props}
      data-type={nullable ? 'number-or-null' : 'number'}
      value={value}
      defaultValue={defaultValue}
    >
      <option value={defaultOptionValue}>{defaultCaption}</option>
      {/* @note only nullable selects can offer "no session" (an explicit 0);
          non-nullable consumers reserve 0 for their automatic default. */}
      {allowNoSession ? <option value={0}>no session</option> : null}
      {Object.entries(minutesMap).map(([ds, minutes]) => {
        return (
          <option key={`minutes-${minutes}`} value={ds}>
            {pluralize('minute', minutes, true)}
          </option>
        )
      })}
      {Object.entries(hoursMap).map(([ds, hours]) => {
        return (
          <option key={`hours-${hours}`} value={ds}>
            {pluralize('hour', hours, true)}
          </option>
        )
      })}
      {Object.entries(daysMap).map(([ds, days]) => {
        return (
          <option key={`days-${days}`} value={ds}>
            {pluralize('day', days, true)}
          </option>
        )
      })}
      {Object.entries(weeksMap).map(([ds, weeks]) => {
        return (
          <option key={`weeks-${weeks}`} value={ds}>
            {pluralize('week', weeks, true)}
          </option>
        )
      })}
      {val &&
      !(
        val in minutesMap ||
        val in hoursMap ||
        val in daysMap ||
        val in weeksMap
      ) ? (
        <option key="other" value={val}>
          {formatDuration(val)}
        </option>
      ) : null}
    </select>
  )
}
