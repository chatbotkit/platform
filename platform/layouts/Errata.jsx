'use client'

// @ts-check
import Meta from '@/components/Meta'

import useEntryAnimation from '@/hooks/useEntryAnimation'

import clsx from 'clsx'

/**
 * @param {string} error
 * @param {string} error_description
 * @returns {{ props: { error: string, error_description: string } }}
 */
export function fail(error, error_description) {
  return {
    props: {
      error,
      error_description,
    },
  }
}

/**
 * @param {{
 *  error?: string,
 *  error_description?: string,
 *  className?: string,
 *  children?: React.ReactNode,
 *  [key: string]: any
 * }} props
 * @returns {import('react').JSX.Element}
 */
export function Error({
  error,
  error_description,

  className,

  children,

  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        'text-sm font-mono transition-all duration-200',
        className
      )}
    >
      {error ? (
        <div>
          <p className="font-bold">{error}</p>
          {error_description ? <p>{error_description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/**
 * @param {{
 *  error?: string,
 *  error_description?: string,
 *  success?: boolean,
 *  title?: string,
 *  description?: string,
 *  className?: string,
 *  children?: React.ReactNode
 *  [key: string]: any
 * }} props
 * @returns {import('react').JSX.Element}
 */
export default function Errata({
  error,
  error_description,

  success: _success,

  title = error ? 'Error' : 'Success',
  description = '',

  children,

  ...props
}) {
  const entryAnimationClassName = useEntryAnimation({
    beforeEnter: 'opacity-0',
    afterEnter: 'opacity-100',

    delay: 2000,

    disabled: !!error,
  })

  return (
    <>
      <Meta title={title} description={description} />
      <div className="w-screen h-screen flex flex-col justify-center items-center">
        <Error
          {...props}
          className={clsx('max-w-lg', entryAnimationClassName)}
          error={error}
          error_description={error_description}
        >
          {children}
        </Error>
      </div>
    </>
  )
}
