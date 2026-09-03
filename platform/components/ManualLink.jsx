import Link from '@/components/Link'

import clsx from 'clsx'

const manualsUrl = 'https://docs.cbk.ai'

export function getManualHref(slug = '') {
  const normalizedSlug = String(slug).replace(/^\/+/, '')

  if (!normalizedSlug) {
    return manualsUrl
  }

  if (/^[?#]/.test(normalizedSlug)) {
    return `${manualsUrl}${normalizedSlug}`
  }

  return `${manualsUrl}/${normalizedSlug}`
}

export default function ManualLink({
  slug,

  target = '_blank',

  className,

  children,

  ...props
}) {
  return (
    <Link
      {...props}
      className={clsx('manual-link', className)}
      href={getManualHref(slug)}
      target={target}
    >
      {children}
    </Link>
  )
}
