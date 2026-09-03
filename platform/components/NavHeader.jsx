import Link from '@/components/Link'

import useIsTop from '@/hooks/useIsTop'

export default function NavHeader({ link, caption, title, beta, children }) {
  const isTop = useIsTop(true)

  return (
    <div className="content-prose space-y-4">
      <div className="space-y-2">
        {isTop ? (
          <Link
            className="print:hidden text-sm default-link group block relative select-none"
            href={link}
          >
            <span className="absolute group-hover:-translate-x-1 transition-all">
              &larr;
            </span>
            <span className="ml-6">back to {caption}</span>
          </Link>
        ) : null}
        {title ? (
          <h1 className="text-4xl font-bold">
            {title}
            {beta ? (
              <sup className="beta">
                {typeof beta === 'boolean' ? 'BETA' : beta}
              </sup>
            ) : null}
          </h1>
        ) : null}
      </div>
      {children ? <div className="print:hidden">{children}</div> : children}
    </div>
  )
}
