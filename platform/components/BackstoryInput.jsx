'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { isDbMediumText } from '@/lib/db.string'
import { extractFields } from '@/lib/field'
import { getRandomId } from '@/lib/string'

import TextareaHighlighter from '@/components/TextareaHighlighter'
import TextareaQuickEditTools from '@/components/TextareaQuickEditTools'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'
import { useExtendWidgetFunctions } from '@/components/Widget'
import ZoomableArea from '@/components/ZoomableArea'

import useControllableInput from '@/hooks/useControllableInput'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useDebounce from '@/hooks/useDebounce'
import useMagicDialog from '@/hooks/useMagicDialog'
import useTabIndent from '@/hooks/useTabIndent'

import {
  ArrowsPointingOutIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'
import pluralize from 'pluralize'

function FieldsInfo({ value }) {
  const debouncedValue = useDebounce(value, 1000)

  const fields = useMemo(() => {
    try {
      const fields = extractFields(debouncedValue || '')

      return fields
    } catch {
      // pass
    }

    return []
  }, [debouncedValue])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div className="flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2 auto-bg-gray-200 auto-text-gray-500">
        <div className="truncate">{fields.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', fields.length)} <strong>{fields.length}</strong>{' '}
        {pluralize('field', fields.length)} in this instruction.
      </div>
    </div>
  )
}

function BackstoryTextarea({
  className,

  containerClassName,
  textareaWrapperClassName,

  value,
  onChange,
  setValue,

  quickEdit = false,

  disabled = false,

  children,

  ...props
}) {
  const containerRef = useRef()

  const [textarea] = useDOMQuerySelector(':scope .backstory-textarea', {
    parent: containerRef.current,
    waitForElements: true,
  })

  const { handleKeyDown, selection } = useTabIndent(onChange)

  useEffect(() => {
    if (!textarea) {
      return
    }

    textarea.selectionStart = selection.start
    textarea.selectionEnd = selection.end
  }, [selection, textarea])

  const keywords = useMemo(() => {
    return [
      // xml
      /^(?<xmltag>\<.*)$/gim, // @note must be first
      // substitutions
      /\$\{(?<substitution>[^}]*)\}/gi,
      /\{\{(?<substitution>[^}]*)\}\}/gi,
      // headings
      /^(?<heading>#.*)$/gim,
      // checkboxes
      /^[ ]*-[ ]*(?<checkbox>\[([ xX])\])/gim,
      // horizontal lines
      /^(?<hr>-{3,})$/gim,
    ]
  }, [])

  return (
    <div className={clsx('relative', containerClassName)} ref={containerRef}>
      <TextareaHighlighter
        key="backstory-highlighter"
        className={clsx(
          'backstory-highlighter',

          'z-10', // place the text highlighter below the textarea

          'auto-text-black', // default text color

          // @note do not use opacity or alpha background colors for the markers
          // otherwise you risk making the text appear bolder

          '[&_mark.xmltag]:bg-orange-500 [&_mark.xmltag]:text-white',
          '[&_mark.substitution]:auto-bg-gray-200 [&_mark.substitution]:auto-text-black',
          '[&_mark.heading]:auto-bg-gray-200 [&_mark.heading]:auto-text-gray-600',
          '[&_mark.checkbox]:bg-green-500 [&_mark.checkbox]:text-white',
          '[&_mark.hr]:auto-bg-gray-200 [&_mark.hr]:auto-text-gray-600'
        )}
        keywords={keywords}
        textarea={textarea}
        value={value}
        top={false}
      />
      <TokenAutoTextarea
        key="backstory-textarea"
        spellCheck={false}
        {...props}
        className={clsx(
          'backstory-textarea',

          'font-mono', // @note because the backstory can include special code like <|tag|> and [tag]

          '!text-transparent !bg-transparent caret-black dark:caret-white',

          'relative z-20', // place the textarea above the text highlighter

          className
        )}
        wrapperClassName={textareaWrapperClassName}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        {children}
      </TokenAutoTextarea>
      {quickEdit ? (
        <TextareaQuickEditTools
          textarea={textarea}
          value={value}
          setValue={setValue}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}

function useBackstoryMagicDialog() {
  const { dialog, open, close } = useMagicDialog({
    promptId: '@backstory',

    title: 'Backstory',

    children: (
      <p className="text-sm">
        Let&apos;s try to generate the perfect backstory for you.
      </p>
    ),

    placeholder:
      'your initial backstory you want to improve goes here, i.e a friendly assistant...',
  })

  return [dialog, open, close]
}

export default function BackstoryInput({
  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  className,
  wrapperClassName,
  containerClassName,
  textareaWrapperClassName,

  fieldsInfo = true,

  zoom = true,

  magic = true,

  quickEdit = true,

  children,

  ...props
}) {
  const ref = useRef(null)

  const inputId = useMemo(() => getRandomId(), [])

  const [value, onChange, setValue] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  // @note register widget functions for AI assistant to get/set the backstory value

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`backstory_input_get_${inputId}`]: {
          description:
            'Get the current value of the backstory input field. Use this to read what the user has entered for the bot backstory.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              value: value || '',
            }
          },
        },
        [`backstory_input_set_${inputId}`]: {
          description:
            'Set the value of the backstory input field. Use this to update or improve the backstory content.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'The new backstory value to set',
              },
            },
            required: ['value'],
          },
          handler: async ({ value: newValue }) => {
            setValue(newValue)

            return {
              success: true,
              value: newValue,
            }
          },
        },
      }),
      [inputId, value, setValue]
    )
  )

  useEffect(() => {
    if (!ref.current) {
      return
    }

    if (!value) {
      ref.current.setCustomValidity('')

      return
    }

    if (isDbMediumText(value)) {
      ref.current.setCustomValidity('')
    } else {
      ref.current.setCustomValidity(`The description is too long.`)
    }
  }, [value])

  const [magicDialog, magicDialogOpen] = useBackstoryMagicDialog()

  const [zoomed, setZoomed] = useState(false)

  async function handleMagicClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    magicDialogOpen({
      input: value,

      callback: (value) => {
        setValue(value)
      },
    })
  }

  return (
    <ZoomableArea
      className={wrapperClassName}
      zoomedContainerClassName="overflow-auto"
      zoomedContentClassName="max-w-3xl mx-auto px-10 py-20 overflow-auto"
      zoomed={zoomed}
      setZoomed={setZoomed}
    >
      {magicDialog}
      <BackstoryTextarea
        {...props}
        containerClassName={containerClassName}
        textareaWrapperClassName={textareaWrapperClassName}
        className={clsx(
          'max-h-96 !overflow-auto', // @note large editable areas are kind of funky to edit so we need to constrain the height

          className,

          // @note positioned at the end to override preceding rules
          {
            '!max-h-none !border-none !outline-none !ring-0 !shadow-none [&:not(.unimportant)]:!text-base':
              zoomed,
          }
        )}
        value={value}
        onChange={onChange}
        setValue={setValue}
        quickEdit={quickEdit}
      >
        {children}
        {fieldsInfo ? <FieldsInfo value={value} /> : null}
        {zoom && !zoomed ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny push"
              type="button"
              onClick={() => setZoomed(true)}
              disabled={props.disabled}
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
            <div className="tooltip w-24 below">Zoom</div>
          </div>
        ) : null}
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
      </BackstoryTextarea>
    </ZoomableArea>
  )
}
