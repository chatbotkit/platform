import pluralize from 'pluralize'

export default function DaysSelect({ defaultCaption = 'automatic', ...props }) {
  return (
    <select {...props}>
      <option value={0}>{defaultCaption}</option>
      {[1, 3, 7, 14, 30, 60, 90].map((days) => {
        return (
          <option key={days} value={days * 24 * 60 * 60 * 1000}>
            {days} {pluralize('days', days)}
          </option>
        )
      })}
    </select>
  )
}
