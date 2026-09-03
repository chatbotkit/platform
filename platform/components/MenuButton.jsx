import NestedAccordion from '@/components/NestedAccordion'
import PopButton from '@/components/PopButton'

import clsx from 'clsx'

export default function MenuButton({
  className,
  menuClassName,

  menu,

  children,

  ...props
}) {
  return (
    <PopButton
      placement="bottom"
      closeOnClick={true}
      {...props}
      className={className}
      caption={children}
    >
      <NestedAccordion
        className={clsx(
          'text-sm',
          'max-w-lg',
          'auto-bg-white',
          'border auto-border-gray-200 rounded-xl overflow-hidden shadow-lg',
          '[&_.nested-accordion-title]:rounded-none [&_.nested-accordion-title]:px-4 [&_.nested-accordion-title]:py-0.5',
          menuClassName
        )}
        items={menu}
        expanded={true}
        collapsible={false}
        selectable={false}
      />
    </PopButton>
  )
}
