import clsx from 'clsx'

export default function Spinner({ className, ...props }) {
  return (
    <svg
      {...props}
      className={clsx('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
