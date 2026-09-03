import Link from '@/components/Link'

import clsx from 'clsx'

export default function BackLink({
  as: Component = Link,

  className,

  children,

  ...props
}) {
  return (
    <Component
      {...props}
      className={clsx(
        'back-link relative group',
        '[&.small_.back-link-arrow]:left-3',
        '[&.tiny_.back-link-arrow]:left-2',
        className
      )}
    >
      <span className="back-link-arrow absolute left-5 group-hover:-translate-x-1 transition-all">
        &larr;
      </span>
      <span className="back-link-children ml-6">{children}</span>
    </Component>
  )
}
