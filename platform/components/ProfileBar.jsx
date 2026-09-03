import ProfileDropdown from '@/components/ProfileDropdown'

import clsx from 'clsx'

export default function ProfileBar({
  className,

  // @note by default the bar free-floats over the top right corner of the page.
  // stretched, it spans the full width it is given - anchor the left edge from
  // the outside with `className` - which is what makes the start of the bar a
  // usable slot, see `leading`. the page scrolls underneath either way, so the
  // stretched bar needs an opaque background across all breakpoints
  stretch = false,

  leading,

  dropdownChildren,

  children,

  ...props
}) {
  return (
    <div
      className={clsx(
        'profile-bar',
        'fixed z-40 top-0 right-0',
        'p-4',
        'flex flex-row gap-2 justify-end items-center',
        stretch
          ? [
              'left-0',
              'auto-bg-white',
              'border-b border-gray-100 dark:border-gray-100',
            ]
          : [
              'w-full',
              'sm:w-auto bg-white dark:bg-black sm:bg-transparent dark:sm:bg-transparent',
              'border-b border-gray-200 dark:border-gray-800 sm:border-0',
            ],
        className
      )}
    >
      {leading ? (
        <div className="flex flex-row items-center min-w-0 mr-auto">
          {leading}
        </div>
      ) : null}
      {children}
      <ProfileDropdown {...props}>{dropdownChildren}</ProfileDropdown>
    </div>
  )
}
