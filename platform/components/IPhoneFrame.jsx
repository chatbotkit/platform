import clsx from 'clsx'

export default function IPhoneFrame({ className, children }) {
  return (
    <div
      className={clsx(
        className,
        'relative bg-black rounded-5xl overflow-hidden border-4 border-black dark:border-white'
      )}
    >
      <div className="absolute z-50 top-2 left-1/2 -translate-x-1/2 w-24 h-5 p-1 bg-black rounded-full flex items-center justify-center" />
      <div className="overflow-hidden flex flex-row w-full h-full">
        {children}
      </div>
    </div>
  )
}
