import clsx from 'clsx'

export default function Box({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx('box flex-1 flex flex-col overflow-hidden', className)}
    />
  )
}
