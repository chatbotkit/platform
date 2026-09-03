import clsx from 'clsx'

/**
 * A textarea that acts like an input. It can be used to create a single-line
 * input that can be tabbed through.
 */
export default function InputArea({
  className,

  type: _type,

  ...props
}) {
  return (
    <textarea className={clsx('resize-none', className)} rows={1} {...props} />
  )
}
