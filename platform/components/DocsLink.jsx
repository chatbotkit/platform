import Link from '@/components/Link'

import clsx from 'clsx'

const docsOrigin = 'https://chatbotkit.com'
const docsUrl = `${docsOrigin}/docs`

export function getDocsHref(slug) {
  if (typeof slug === 'undefined') {
    return docsUrl
  }

  const normalizedSlug = String(slug).replace(/^\/+/, '')

  if (!normalizedSlug) {
    return `${docsUrl}/`
  }

  if (/^[?#]/.test(normalizedSlug)) {
    return `${docsUrl}${normalizedSlug}`
  }

  return `${docsUrl}/${normalizedSlug}`
}

export default function DocsLink({
  slug,

  href: _href = getDocsHref(slug),

  target = '_blank',

  className,

  children,

  ...props
}) {
  const href = new URL(_href, docsOrigin).toString()

  return (
    <Link
      {...props}
      className={clsx('docks-link', className)}
      href={href}
      target={target}
    >
      {children}
    </Link>
  )
}
