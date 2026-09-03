import clsx from 'clsx'

export default function BackButton({
  as: Component = 'button',

  className,

  children,

  type = Component === 'button' ? 'button' : undefined,

  ...props
}) {
  return (
    <Component
      type={type}
      {...props}
      className={clsx(
        'back-button relative group',
        '[&.small_.back-button-arrow]:left-3',
        '[&.tiny_.back-button-arrow]:left-2',
        className
      )}
    >
      <span className="back-button-arrow absolute left-5 group-hover:-translate-x-1 transition-all">
        &larr;
      </span>
      <span className="back-button-children ml-6">{children}</span>
    </Component>
  )
}
