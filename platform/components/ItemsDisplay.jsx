import { useCallback } from 'react'

import Link from '@/components/Link'

import useFramePopup from '@/hooks/useFramePopup'

import clsx from 'clsx'

export default function ItemsDisplay({
  items,

  cols = 3,

  className,

  children,

  ...props
}) {
  const { popup, openFramePopup } = useFramePopup()

  const handlePopupClick = useCallback(
    (link) => {
      openFramePopup(link, {
        iframeClassName: 'w-full h-[70vh] border-0',
        dialogClassName: '!max-w-4xl',
        animateContentHeight: true,
        contentClassName: undefined,
      })
    },
    [openFramePopup]
  )

  return (
    <>
      {popup}
      <div
        {...props}
        className={clsx(
          'mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-16 grid grid-cols-1 gap-4',
          {
            'md:grid-cols-3': cols === 3,
            'md:grid-cols-4': cols === 4,
          },
          className
        )}
      >
        {items.map(
          (
            { name, logo: Logo, icon: Icon, description, link, target },
            index
          ) => {
            const isPopup = target === '_popup'

            const Wrapper = link
              ? isPopup
                ? ({ className, ...props }) => (
                    <button
                      {...props}
                      type="button"
                      className={clsx(className)}
                      onClick={() => handlePopupClick(link)}
                    />
                  )
                : ({ className, ...props }) => (
                    <Link
                      {...props}
                      className={clsx(className)}
                      href={link}
                      target={target}
                    />
                  )
              : ({ className, ...props }) => (
                  <div
                    {...props}
                    className={clsx(className, 'cursor-default')}
                    href={link}
                    target={target}
                  />
                )

            return (
              <Wrapper
                key={index}
                className={clsx(
                  'flex flex-col items-center gap-4',
                  'rounded-xl p-5',
                  'text-center',
                  'border auto-border-gray-100',
                  'hover:scale-105 hover:auto-border-gray-200 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-950 dark:hover:to-gray-900',
                  'transition-all duration-300 ease-in-out'
                )}
              >
                {Logo ? <Logo className="h-16 " /> : null}
                {Icon ? <Icon className="h-16 " /> : null}
                <h3 className="text-xl font-bold">{name}</h3>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  {description}
                </p>
              </Wrapper>
            )
          }
        )}
        {children}
      </div>
    </>
  )
}
