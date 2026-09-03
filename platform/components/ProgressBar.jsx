import clsx from 'clsx'

export default function ProgressBar({
  used = 0,
  total = 0,
  useThresholdColors = false,
  className,
  barClassName,
}) {
  const percentage =
    Number.isFinite(total) && total > 0
      ? Math.max(0, Math.min(100, Math.round((used / total) * 100)))
      : 0

  const colorClassName = useThresholdColors
    ? {
        'bg-[var(--color-accent)]': !percentage || percentage < 75,
        'bg-orange-500 dark:bg-orange-500': percentage >= 75 && percentage < 90,
        'bg-red-500 dark:bg-red-500': percentage >= 90,
      }
    : 'bg-[var(--color-accent)]'

  return (
    <div
      className={clsx('bg-gray-100 dark:bg-gray-900 rounded-xl h-2', className)}
    >
      <div
        className={clsx('rounded-xl h-2', colorClassName, barClassName)}
        style={{
          width: `${percentage}%`,
          maxWidth: '100%',
        }}
      />
    </div>
  )
}
