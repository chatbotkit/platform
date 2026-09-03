import { useEffect, useState } from 'react'

import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useMagicDialog from '@/hooks/useMagicDialog'

import { SparklesIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export default function RecordInput({
  className,
  wrapperClassName,

  ...props
}) {
  const [value, setValue] = useState(props.value || props.defaultValue || '')

  useEffect(() => {
    if (props.value !== value && props.value !== undefined) {
      setValue(props.value)
    }
    // @note do not include the "value" because the code will not work as
    // expected, otherwise the token calculation will not work
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, setValue])

  function handleOnChange(event) {
    setValue(event.target.value)

    if (props.onChange) {
      props.onChange(event)
    }
  }

  const { dialog, open } = useMagicDialog({
    promptId: '@record',

    title: 'Record',

    children: (
      <p className="text-sm">
        Let&apos;s try to generate the perfect dataset record for you.
      </p>
    ),

    placeholder:
      'your initial record you want to improve goes here, i.e. there are...',
  })

  async function handleMagicClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    open({
      input: value,

      callback: (value) => {
        setValue(value)
      },
    })
  }

  return (
    <div>
      {dialog}
      <div className="relative">
        <TokenAutoTextarea
          {...props}
          className={clsx('max-h-96 !overflow-auto', className)}
          wrapperClassName={wrapperClassName}
          value={value}
          onChange={handleOnChange}
        >
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny push"
              type="button"
              onClick={handleMagicClick}
              disabled={props.disabled}
            >
              <SparklesIcon className="w-5 h-5" />
            </button>
            <div className="tooltip w-24 below">Magic</div>
          </div>
        </TokenAutoTextarea>
      </div>
    </div>
  )
}
