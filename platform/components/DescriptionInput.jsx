import { useEffect, useRef } from 'react'

import { isDbText } from '@/lib/db.string'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import Component from '@/components/Component'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useControllableInput from '@/hooks/useControllableInput'
import useMagicDialog from '@/hooks/useMagicDialog'

import { SparklesIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export default function DescriptionInput({
  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  className,
  wrapperClassName,
  containerClassName,
  textareaWrapperClassName,

  countTokens,

  magic = true,

  children,

  ...props
}) {
  const ref = useRef(null)

  const [value, onChange, setValue] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  useEffect(() => {
    if (!ref.current) {
      return
    }

    if (!value) {
      ref.current.setCustomValidity('')

      return
    }

    if (isDbText(value)) {
      ref.current.setCustomValidity('')
    } else {
      ref.current.setCustomValidity(`The description is too long.`)
    }
  }, [value])

  const { dialog: magicDialog, open: openMagic } = useMagicDialog({
    promptId: '@description',

    title: 'Description',

    children: (
      <p className="text-sm">
        Let&apos;s try to generate the perfect description for you.
      </p>
    ),

    placeholder:
      'your initial description you want to improve goes here, i.e. this is a...',
  })

  async function handleMagicClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    openMagic({
      input: value,

      callback: (value) => {
        setValue(value)
      },
    })
  }

  return (
    <div className={wrapperClassName}>
      {magicDialog}
      <div className={clsx('relative', containerClassName)}>
        <Component
          {...props}
          className={clsx(
            'max-h-96 !overflow-auto', // @note large editable areas are kind of funky to edit so we need to constrain the height

            className
          )}
          wrapperClassName={textareaWrapperClassName}
          value={value}
          onChange={onChange}
          as={countTokens ? TokenAutoTextarea : AdvancedAutoTextarea}
          ref={ref}
        >
          {children}
          {magic ? (
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
          ) : null}
        </Component>
      </div>
    </div>
  )
}
