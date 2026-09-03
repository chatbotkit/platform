import { saveData } from '@/lib/save'
import { toKebabCase } from '@/lib/string'

import { GlobalRootPortal } from '@/components/GlobalRoot'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'

export default function ExportLink({
  path,

  title = '',

  description = '',

  name = 'data',

  className,

  children,

  disabled,

  ...props
}) {
  const { fetch } = useFetch({
    loadingMessage: `Exporting ${name}...`,
    failureMessage: true,

    loadingMessageDuration: 3.6e6, // one hour in milliseconds

    dataType: 'text',
  })

  const { popup, openPopup, closePopup } = usePopup({
    title,

    closePopupOnClickOutside: false,

    actions: {
      'Export JSON': {
        fn: async () => {
          const { data } = await fetch(path, {
            headers: {
              accept: 'application/jsonl',
            },
          })

          const content = `[\n${data.trim().replace(/\n/g, ',\n')}\n]`

          saveData(content, {
            name: `${toKebabCase(name)}.json`,
            type: 'application/json',
          })

          closePopup()
        },
      },

      'Export CSV': {
        default: true,

        fn: async () => {
          const { data } = await fetch(path, {
            headers: {
              accept: 'text/csv',
            },
          })

          const content = data

          saveData(content, {
            name: `${toKebabCase(name)}.csv`,
            type: 'text/csv',
          })

          closePopup()
        },
      },
    },
  })

  function launch() {
    if (disabled) {
      return
    }

    openPopup(<div>{description}</div>)
  }

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div
        {...props}
        className={clsx(className, { disabled })}
        onClick={launch}
      >
        {title}
        {children}
      </div>
    </>
  )
}
