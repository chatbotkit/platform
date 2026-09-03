import clsx from 'clsx'

export const DOT = '●'

export const DIAMOND = '◆'

export default function DotsLoader({ dot = DOT, className, ...props }) {
  return (
    <div
      {...props}
      className={clsx('inline-flex flex-row gap-2 select-none', className)}
    >
      <span className="animate-pulse [animation-delay:-0.3s]">{dot}</span>
      <span className="animate-pulse [animation-delay:-0.15s]">{dot}</span>
      <span className="animate-pulse">{dot}</span>
    </div>
  )
}
