import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { schemaErrorToError } from '@/lib/joi.schema'
import { parse, tryStringify } from '@/lib/yaml'
import { getFriendlyErrorMessage } from '@/lib/zod.error'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import TextareaHighlighter from '@/components/TextareaHighlighter'
import ZoomableArea from '@/components/ZoomableArea'

import useControllableInput from '@/hooks/useControllableInput'
import useControlledState from '@/hooks/useControlledState'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useDebounce from '@/hooks/useDebounce'
import useTabIndent from '@/hooks/useTabIndent'

import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

function ValidationInfo({ value, validationState, description }) {
  // @note only show validation indicator when there's content to validate

  if (!value?.trim?.()) {
    return null
  }

  // @note when valid, surface an optional plain-language description of the
  // parsed object (e.g. what a policy means) on hover; when invalid, the error.

  const tooltip = validationState.hasError
    ? validationState.errorMessage
    : description

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div
        className={clsx(
          'flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2',
          {
            'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500':
              !validationState.hasError,
            'bg-red-500 text-white': validationState.hasError,
          }
        )}
      >
        <div className="truncate">
          {!validationState.hasError ? 'valid' : 'invalid'}
        </div>
      </div>
      {tooltip ? (
        <div className="tooltip below w-48 text-center whitespace-pre-wrap">
          {tooltip}
        </div>
      ) : null}
    </div>
  )
}

function ObjectTextarea({
  className,

  containerClassName,

  value,
  onChange,

  setTextarea,

  children,

  ...props
}) {
  const containerRef = useRef()

  const [textarea] = useDOMQuerySelector(':scope .object-textarea', {
    parent: containerRef.current,
    waitForElements: true,
  })

  useEffect(() => {
    if (setTextarea) {
      setTextarea(textarea)
    }
  }, [setTextarea, textarea])

  const { handleKeyDown, selection } = useTabIndent(onChange)

  useEffect(() => {
    if (!textarea) {
      return
    }

    textarea.selectionStart = selection.start
    textarea.selectionEnd = selection.end
  }, [selection, textarea])

  const keywords = useMemo(() => {
    return [/^[ ]*(?<yamlkey>[^\s:]+:(?=\s|$))/gim]
  }, [])

  return (
    <div
      className={clsx('relative w-full', containerClassName)}
      ref={containerRef}
    >
      <TextareaHighlighter
        key="object-highlighter"
        className={clsx(
          'object-highlighter',

          'z-10', // place the text highlighter below the textarea

          'auto-text-black', // default text color

          // @note do not use opacity or alpha background colors for the markers
          // otherwise you risk making the text appear bolder

          '[&_mark.yamlkey]:auto-bg-gray-50 [&_mark.yamlkey]:auto-text-gray-500'
        )}
        keywords={keywords}
        textarea={textarea}
        value={value}
        top={false}
      />
      <AdvancedAutoTextarea
        key="object-textarea"
        spellCheck={false}
        {...props}
        className={clsx(
          'object-textarea',

          'font-mono',

          '!text-transparent !bg-transparent caret-black dark:caret-white',

          'relative z-20', // place the textarea above the text highlighter

          className
        )}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      >
        {children}
      </AdvancedAutoTextarea>
    </div>
  )
}

export default function ObjectInput({
  className,
  wrapperClassName,
  containerClassName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  defaultObject: _defaultObject = null,
  object: _object,
  setObject: _setObject,

  zodSchema, // @note optional Zod schema for validation
  joiSchema, // @note optional Joi schema for validation (not implemented yet)
  onValidationChange, // @note callback when validation state changes

  describe, // @note optional (object) => string shown as a tooltip when valid

  zoom = true, // @note enable/disable zoom functionality

  children,

  ...props
}) {
  const [textarea, setTextarea] = useState(null)

  // @note track focus state to prevent reformatting while user is editing

  const [isFocused, setIsFocused] = useState(false)

  // @todo refactor the code to only use one set of controlled state

  const [object, setObject] = useControlledState(
    _defaultObject,
    _object,
    _setObject
  )

  const [value, onChange, setValue] = useControllableInput({
    // @note show empty string when object is null to avoid displaying "null" text
    defaultValue: () =>
      _defaultValue ?? (object !== null ? tryStringify(object) : ''),

    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  // @note sync value from object when object is controlled externally and
  // changes but only when the textarea is not focused to avoid reformatting
  // during editing

  useEffect(() => {
    // @note only sync if object is controlled (passed from outside) and value
    // is not controlled and the textarea is not focused (user is not actively
    // editing)
    if (_object !== undefined && _value === undefined && !isFocused) {
      // @note show empty string when object is null to avoid displaying "null" text
      const newValue = _object !== null ? tryStringify(_object) || '' : ''

      setValue(newValue)
    }
  }, [_object, _value, setValue, isFocused])

  const debouncedValue = useDebounce(value, 500)

  const [validationState, setValidationState] = useState({
    hasError: false,
    errorMessage: '',
  })

  const validateWithZod = useCallback(
    (obj) => {
      if (zodSchema) {
        try {
          zodSchema.parse(obj)

          return { success: true, error: null }
        } catch (error) {
          return { success: false, error: getFriendlyErrorMessage(error) }
        }
      }

      return { success: true, error: null }
    },
    [zodSchema]
  )

  const validateWithJoi = useCallback(
    (obj) => {
      if (joiSchema) {
        try {
          const { error } = joiSchema.validate(obj, { abortEarly: false })

          if (error) {
            return { success: false, error: schemaErrorToError(error).message }
          }

          return { success: true, error: null }
        } catch (error) {
          return { success: false, error: schemaErrorToError(error).message }
        }
      }

      return { success: true, error: null }
    },
    [joiSchema]
  )

  useEffect(() => {
    if (!textarea) {
      return
    }

    let newValidationState = {
      hasError: false,
      errorMessage: '',
    }

    try {
      if (!debouncedValue?.trim?.()) {
        // @note clear validation state for empty input

        textarea.setCustomValidity('')

        setObject(null)

        setValidationState(newValidationState)

        onValidationChange?.(
          !newValidationState.hasError,
          newValidationState.errorMessage
        )

        return
      }

      const parsedObject = parse(debouncedValue)

      if (typeof parsedObject === 'undefined') {
        // @note clear validation state for undefined result

        textarea.setCustomValidity('')

        setObject(null)

        setValidationState(newValidationState)

        onValidationChange?.(
          !newValidationState.hasError,
          newValidationState.errorMessage
        )

        return
      }

      if (typeof parsedObject !== 'object') {
        throw new Error(`Expecting an object, got ${typeof parsedObject}.`)
      }

      let customValidator

      {
        if (zodSchema) {
          customValidator = validateWithZod
        }

        if (joiSchema) {
          customValidator = validateWithJoi
        }
      }

      if (customValidator) {
        const result = customValidator(parsedObject)

        if (!result.success) {
          newValidationState = {
            hasError: true,
            errorMessage: result.error,
          }

          // @note set custom validity for form validation but don't show browser UI

          textarea.setCustomValidity(newValidationState.errorMessage)

          // @note still set the object even if Zod validation fails

          setObject(parsedObject)

          setValidationState(newValidationState)

          onValidationChange?.(
            !newValidationState.hasError,
            newValidationState.errorMessage
          )

          return
        }
      }

      // @note clear validation state for valid input

      textarea.setCustomValidity('')

      setObject(parsedObject)

      setValidationState(newValidationState)

      onValidationChange?.(
        !newValidationState.hasError,
        newValidationState.errorMessage
      )
    } catch (e) {
      newValidationState = {
        hasError: true,
        errorMessage: e.message,
      }

      // @note set custom validity for form validation but don't show browser UI

      textarea.setCustomValidity(e.message)

      setValidationState(newValidationState)

      onValidationChange?.(
        !newValidationState.hasError,
        newValidationState.errorMessage
      )
    }
  }, [
    textarea,
    debouncedValue,
    setObject,
    validateWithZod,
    validateWithJoi,
    onValidationChange,
    zodSchema,
    joiSchema,
  ])

  const [zoomed, setZoomed] = useState(false)

  // @note best-effort description of the current valid object; never throws so
  // it can be rendered unconditionally.

  let description = ''

  if (describe && !validationState.hasError) {
    try {
      description = describe(object) || ''
    } catch {
      description = ''
    }
  }

  return (
    <ZoomableArea
      className={wrapperClassName}
      zoomedContainerClassName="overflow-auto"
      zoomedContentClassName="max-w-3xl mx-auto px-10 py-20 overflow-auto"
      zoomed={zoomed}
      setZoomed={setZoomed}
    >
      <ObjectTextarea
        {...props}
        containerClassName={containerClassName}
        className={clsx(
          'max-h-96 !overflow-auto', // @note large editable areas are kind of funky to edit so we need to constrain the height

          'break-all',

          className,

          // @note positioned at the end to override preceding rules
          {
            '!max-h-none !border-none !outline-none !ring-0 !shadow-none [&:not(.unimportant)]:!text-base':
              zoomed,
          }
        )}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        setTextarea={setTextarea}
        data-type="object"
      >
        <ValidationInfo
          value={debouncedValue}
          validationState={validationState}
          description={description}
        />
        {children}
        {zoom && !zoomed ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny"
              type="button"
              onClick={() => setZoomed(true)}
              disabled={props.disabled}
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
            <div className="tooltip w-24 below">Zoom</div>
          </div>
        ) : null}
      </ObjectTextarea>
    </ZoomableArea>
  )
}
