import Link from '@/components/Link'

import clsx from 'clsx'

export default function ForwardLink({ className, children, ...props }) {
  return (
    <Link {...props} className={clsx('relative group', className)}>
      <span className="mr-6">{children}</span>
      <span className="absolute right-5 group-hover:translate-x-1 transition-all">
        &rarr;
      </span>
    </Link>
  )
}
