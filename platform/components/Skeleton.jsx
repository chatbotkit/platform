import clsx from 'clsx'

export default function Skeleton({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'skeleton bg-gray-100 dark:bg-gray-900',
        'animate-pulse',
        className
      )}
    />
  )
}
