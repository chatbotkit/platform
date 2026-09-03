import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { assert } from '@/lib/debug'
import { isComponent } from '@/lib/react'

import ColoredInput from '@/components/ColorInput'
import Expando from '@/components/Expando'
import RevealToken from '@/components/RevealToken'
import Toggle from '@/components/Toggle'
import TooltipButton from '@/components/TooltipButton'

import useControlledState from '@/hooks/useControlledState'
import useDebounce from '@/hooks/useDebounce'
import useInitial from '@/hooks/useInitial'

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export const InputContext = createContext()

export function useInputContext() {
  return useContext(InputContext)
}

export function InputContextProvider({
  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  ...props
}) {
  return (
    <InputContext.Provider
      {...props}
      value={useControlledState(_defaultValue, _value, _setValue)}
    />
  )
}

export function List({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'list',
        'flex flex-col gap-1',
        // 'divide-y divide-gray-100 dark:divide-gray-900',
        className
      )}
    >
      {children}
    </div>
  )
}

List.Memo = memo(List)

export function StateToggle({ state }) {
  return state?.optional ? (
    <button
      className={clsx(
        'state-toggle',
        'rounded-full w-[0.8em] h-[0.8em]',
        'transition-all ease-in-out duration-200',
        {
          'text-gray-200 hover:text-gray-800 dark:text-gray-800 dark:hover:text-gray-200':
            state.disabled,
        }
      )}
      type="button"
      onClick={() => {
        state.setDisabled((disabled) => !disabled)
      }}
      data-disabled={state.disabled}
    >
      {state.disabled ? (
        <EyeSlashIcon className="w-full h-full" />
      ) : (
        <EyeIcon className="w-full h-full" />
      )}
    </button>
  ) : null
}

StateToggle.Memo = memo(StateToggle)

export function Item({
  label,

  name,
  description,

  state,

  className,

  children,

  ...props
}) {
  const contextSchema = useContextSchema()

  const resolvedLabel = label || name
  const resolvedLabelText =
    typeof resolvedLabel === 'string' ? resolvedLabel : undefined

  return (
    <div
      {...props}
      className={clsx('item', 'flex flex-row gap-2 items-center', className)}
    >
      <div className="item-header flex flex-row gap-2 items-center select-none">
        <StateToggle state={state} />
        {contextSchema?.labelTooltipButton && resolvedLabelText ? (
          <TooltipButton
            as="label"
            className="flex-1 w-full"
            tooltip={resolvedLabelText}
            transitionStyles="scale"
          >
            {resolvedLabel}
          </TooltipButton>
        ) : (
          <label className="flex-1 w-full">{resolvedLabel}</label>
        )}
      </div>
      <div
        className={clsx(
          'content',
          'flex-1 w-full',
          'flex flex-row gap-2 items-center',
          'py-0.5'
        )}
      >
        {children}
      </div>
      {description ? (
        <div className="description hidden">{description}</div>
      ) : null}
    </div>
  )
}

Item.Memo = memo(Item)

export function Folder({
  label,

  name,
  description,

  state,

  defaultOpen = true,

  className,

  children,

  ...props
}) {
  const contextSchema = useContextSchema()

  const resolvedLabel = label || name
  const resolvedLabelText =
    typeof resolvedLabel === 'string' ? resolvedLabel : undefined

  return (
    <Expando
      {...props}
      className={clsx('folder', className)}
      title={
        contextSchema?.labelTooltipButton && resolvedLabelText ? (
          <TooltipButton
            as="label"
            className="flex-1 w-full"
            tooltip={resolvedLabelText}
            transitionStyles="scale"
          >
            {resolvedLabel}
          </TooltipButton>
        ) : (
          <label className="flex-1 w-full">{resolvedLabel}</label>
        )
      }
      defaultOpen={defaultOpen}
      beforeTitle={<StateToggle state={state} />}
    >
      <div className="input-description">{description}</div>
      <div>{children}</div>
    </Expando>
  )
}

Folder.Memo = memo(Folder)

export const SerializationError = Symbol('SerializationError')
export const DeserializationError = Symbol('DeserializationError')

export function useInputState({
  name,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled: _defaultDisabled = false,
  disabled: _disabled,
  setDisabled: _setDisabled,

  optional = false, // @note optional fields are fields that can be en/disabled

  serializer: _serializer,
  deserializer: _deserializer,

  debounce = 0,
}) {
  const [context, setContext] = useInputContext()

  const [error, setError] = useState(null)
  const errorRef = useRef(error)

  useEffect(() => {
    errorRef.current = error
  }, [error])

  const isControlled = _value !== undefined || _setValue !== undefined

  const isApplyingContextValueRef = useRef(false)

  const lastContextValueRef = useRef()

  // @note tracks whether we have a locally-committed value that has not yet
  // been observed in the incoming context. Without this guard, a stale
  // context snapshot (e.g. arriving one render late through React Flow's
  // external store) would re-fire effect 1 and overwrite the value we just
  // typed with the previous context value. The user-visible symptom is each
  // keystroke appearing on the NEXT keystroke (one-letter typing lag).
  const pendingCommitRef = useRef(false)

  const serializer = useInitial(() => _serializer)
  const deserializer = useInitial(() => _deserializer)

  const serialize = useCallback(
    (v) => {
      try {
        try {
          return serializer ? serializer(v) : v
        } finally {
          if (errorRef.current !== null) {
            setError(null)
          }
        }
      } catch (e) {
        if (errorRef.current !== e) {
          setError(e)
        }

        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error(`Failed to serialize value for ${name}`, e)
        }

        return SerializationError
      }
    },
    [name, serializer]
  )

  const deserialize = useCallback(
    (v) => {
      try {
        try {
          return deserializer ? deserializer(v) : v
        } finally {
          if (errorRef.current !== null) {
            setError(null)
          }
        }
      } catch (e) {
        if (errorRef.current !== e) {
          setError(e)
        }

        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error(`Failed to deserialize value for ${name}`, e)
        }

        return DeserializationError
      }
    },
    [name, deserializer]
  )

  const [value, setValueRaw] = useControlledState(
    useInitial(() => {
      if (context && Object.prototype.hasOwnProperty.call(context, name)) {
        const contextValue = deserialize(context[name])

        if (contextValue !== DeserializationError) {
          return contextValue
        }
      }

      return _defaultValue
    }),
    _value,
    _setValue
  )

  const [disabled, setDisabled] = useControlledState(
    _defaultDisabled,
    _disabled,
    _setDisabled
  )

  // @note we use to use the value directly in the two useEffects below but that
  // can sometimes cause the UI to slow down in some cases - we now use the
  // debounced value instead and this note is here to remind us of that in case
  // we run into issues in the future

  const debouncedValue = useDebounce(value, debounce)

  const commitValueToContext = useCallback(
    (nextValue) => {
      if (optional && disabled) {
        setContext((prev) => {
          if (
            prev == null ||
            !Object.prototype.hasOwnProperty.call(prev, name)
          ) {
            return prev
          }

          const next = { ...prev }

          delete next[name]

          return next
        })

        lastContextValueRef.current = undefined

        return
      }

      const newContextValue = serialize(nextValue)

      if (newContextValue === SerializationError) {
        return
      }

      isApplyingContextValueRef.current = false
      lastContextValueRef.current = newContextValue
      pendingCommitRef.current = true

      setContext((prev) => {
        if (Object.is(prev?.[name], newContextValue)) {
          return prev
        }

        return {
          ...prev,

          [name]: newContextValue,
        }
      })
    },
    [disabled, name, optional, serialize, setContext]
  )

  // @note keep the latest value in a ref so that setValue's identity does not
  // change on every keystroke. If `value` were in setValue's deps, every value
  // update would produce a new setValue function, which then propagates down
  // through controlled-state chains (e.g. MetaInput -> ObjectInput) and lands
  // in downstream useEffect deps. Those effects would then re-fire and emit
  // freshly constructed objects (e.g. parse(text)) back up the chain, causing
  // an infinite update loop in the live designer.
  const valueRef = useRef(value)

  valueRef.current = value

  const setValue = useCallback(
    (nextValueOrUpdater) => {
      const baseValue = valueRef.current

      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(baseValue)
          : nextValueOrUpdater

      if (Object.is(nextValue, baseValue)) {
        return
      }

      setValueRaw(nextValue)
      commitValueToContext(nextValue)
    },
    [commitValueToContext, setValueRaw]
  )

  useEffect(() => {
    if (!context || !Object.prototype.hasOwnProperty.call(context, name)) {
      return
    }

    const contextValue = context[name]

    if (Object.is(contextValue, lastContextValueRef.current)) {
      // @note context just caught up with our most recent commit; clear the
      // pending flag so future external changes are honoured.
      pendingCommitRef.current = false

      return
    }

    if (pendingCommitRef.current) {
      // @note context is stale relative to our most recent commit. Do NOT
      // overwrite the local value with this stale snapshot; just wait for
      // context to catch up. See pendingCommitRef declaration for details.
      return
    }

    lastContextValueRef.current = contextValue

    if (isControlled) {
      return
    }

    const nextValue = deserialize(contextValue)

    if (nextValue !== DeserializationError && !Object.is(nextValue, value)) {
      isApplyingContextValueRef.current = true
      setValueRaw(nextValue)
    }
  }, [context, deserialize, isControlled, name, setValueRaw, value])

  useEffect(() => {
    if (!Object.is(debouncedValue, value)) {
      return
    }

    if (optional && disabled) {
      setContext((prev) => {
        if (prev == null || !Object.prototype.hasOwnProperty.call(prev, name)) {
          return prev
        }

        const next = { ...prev }

        delete next[name]

        return next
      })

      lastContextValueRef.current = undefined

      return
    }

    const newContextValue = serialize(debouncedValue)

    if (newContextValue === SerializationError) {
      return
    }

    if (
      isApplyingContextValueRef.current &&
      !Object.is(newContextValue, lastContextValueRef.current)
    ) {
      return
    }

    isApplyingContextValueRef.current = false
    lastContextValueRef.current = newContextValue

    setContext((prev) => {
      if (Object.is(prev?.[name], newContextValue)) {
        return prev
      }

      return {
        ...prev,

        [name]: newContextValue,
      }
    })
  }, [name, disabled, optional, serialize, setContext, debouncedValue, value])

  return {
    value,
    setValue,

    disabled,
    setDisabled,

    optional,

    error,
  }
}

export function TextLineInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('text-line-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <input
        className={clsx('w-full', inputClassName)}
        value={state.value ?? ''}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

TextLineInput.Memo = memo(TextLineInput)

export function TextAreaInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('text-area-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <textarea
        className={clsx('w-full', inputClassName)}
        value={state.value ?? ''}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

TextAreaInput.Memo = memo(TextAreaInput)

export function NumberInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = 0,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  min,
  max,
  step,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('number-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <input
        className={clsx('w-full', inputClassName)}
        type="number"
        value={state.value ?? ''}
        onChange={(event) => {
          const value = event.target.value

          // @note convert string to number, but preserve empty string for user input

          state.setValue(value === '' ? '' : Number(value))
        }}
        min={min}
        max={max}
        step={step}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

NumberInput.Memo = memo(NumberInput)

export function PasswordInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('password-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <RevealToken
        className={clsx('w-full', inputClassName)}
        token={state.value}
        setToken={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

PasswordInput.Memo = memo(PasswordInput)

export function SelectInput({
  label,

  name,
  description,

  options = [],

  defaultValue: _defaultValue = options?.length > 0 ? options[0]?.value : '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('select-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <select
        className={clsx('w-full', inputClassName)}
        value={state.value ?? ''}
        onChange={(event) => state.setValue(event.target.value)}
        disabled={state.disabled}
      >
        {options.length === 0 ? (
          <option value="" disabled>
            No options available
          </option>
        ) : (
          options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))
        )}
      </select>
      {children}
    </Item>
  )
}

SelectInput.Memo = memo(SelectInput)

export function ToggleInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = false,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Item
      {...props}
      className={clsx('toggle-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <Toggle
        className={inputClassName}
        checked={state.value}
        setChecked={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

ToggleInput.Memo = memo(ToggleInput)

export function ColorInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = '#000000',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  const stateValue = state.value
  const setStateValue = state.setValue

  const value = useMemo(() => {
    return stateValue
  }, [stateValue])

  const setValue = useCallback(
    (value) => {
      // @note trim only leading/trailing whitespace, preserve internal spaces for valid color names
      // @note guard against non-string values (e.g. undefined) from color picker edge cases

      setStateValue(typeof value === 'string' ? value.trim() : value)
    },
    [setStateValue]
  )

  return (
    <Item
      {...props}
      className={clsx('color-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <ColoredInput
        className={clsx('w-full', inputClassName)}
        value={value}
        setValue={setValue}
        disabled={state.disabled}
      />
      {children}
    </Item>
  )
}

ColorInput.Memo = memo(ColorInput)

export function ArrayInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = [],
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Folder
      {...props}
      className={clsx('array-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <InputContextProvider value={state.value} setValue={state.setValue}>
        {children}
      </InputContextProvider>
    </Folder>
  )
}

ArrayInput.Memo = memo(ArrayInput)

export function ObjectInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = {},
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  return (
    <Folder
      {...props}
      className={clsx('object-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <InputContextProvider value={state.value} setValue={state.setValue}>
        {children}
      </InputContextProvider>
    </Folder>
  )
}

ObjectInput.Memo = memo(ObjectInput)

export default function ContextInput({ children, ...props }) {
  return <InputContextProvider {...props}>{children}</InputContextProvider>
}

ContextInput.Memo = memo(ContextInput)

export const ContextSchemaContext = createContext()

export function useContextSchema() {
  return useContext(ContextSchemaContext)
}

export function ContextSchema({
  schema,

  className,
  inputClassName,

  labelTooltipButton,

  children,

  ...props
}) {
  assert(schema.type === 'object', 'Schema must be an object')

  return (
    <ContextSchemaContext.Provider
      value={useMemo(() => {
        return { schema, inputClassName, labelTooltipButton }
      }, [schema, inputClassName, labelTooltipButton])}
    >
      <ContextInput {...props}>
        <ContextSchema.ObjectProperties className={className} schema={schema}>
          {children}
        </ContextSchema.ObjectProperties>
      </ContextInput>
    </ContextSchemaContext.Provider>
  )
}

ContextSchema.Memo = memo(function ContextSchemaMemo(props) {
  return <ContextSchema {...props} />
})

ContextSchema.Router = memo(function ContextSchemaRouter({
  schema,

  name,

  optional,

  ...props
}) {
  if (isComponent(schema.format)) {
    const Component = schema.format

    return (
      <Component
        {...props}
        schema={schema}
        name={name}
        optional={optional}
        defaultValue={schema.default}
      />
    )
  }

  switch (schema.type) {
    case 'string': {
      return (
        <ContextSchema.String
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    case 'number': {
      return (
        <ContextSchema.Number
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    case 'integer': {
      return (
        <ContextSchema.Integer
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    case 'boolean': {
      return (
        <ContextSchema.Boolean
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    case 'array': {
      return (
        <ContextSchema.Array
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    case 'object': {
      return (
        <ContextSchema.Object
          {...props}
          schema={schema}
          name={name}
          optional={optional}
        />
      )
    }

    default: {
      assert(false, `Invalid schema type: ${schema.type}`)
    }
  }
})

ContextSchema.Array = memo(function ContextSchemaArray({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'array', 'Schema must be an array')

  return schema.items?.length > 0 ? (
    <ArrayInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      <ContextSchema.ArrayItems schema={schema} name={name} />
      {children}
    </ArrayInput>
  ) : null
})

ContextSchema.ArrayItems = memo(function ContextSchemaArrayItems({
  schema,

  name,

  children,

  ...props
}) {
  assert(schema.type === 'array', 'Schema must be an array')

  return (
    <List {...props}>
      {(schema.items || []).map((schema, index) => (
        <ContextSchema.Router
          key={index}
          schema={schema}
          name={name}
          index={index}
        />
      ))}
      {children}
    </List>
  )
})

ContextSchema.Object = memo(function ContextSchemaObject({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'object', 'Schema must be an object')

  return Object.keys(schema.properties || {}).length > 0 ? (
    <ObjectInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      <ContextSchema.ObjectProperties schema={schema} />
      {children}
    </ObjectInput>
  ) : null
})

ContextSchema.ObjectProperties = memo(function ContextSchemaObjectProperties({
  schema,

  children,

  ...props
}) {
  assert(
    schema.type === 'object' && schema !== null,
    'Schema must be an object'
  )

  const [context] = useInputContext()

  return (
    <List {...props}>
      {Object.entries(schema.properties || {}).map(
        ([propertyName, propertySchema]) => {
          const isRequiredBySchema = !!schema.required?.includes(propertyName)
          const isRequiredByProps = !!propertySchema['react:props']?.required

          const isRequired = isRequiredBySchema || isRequiredByProps

          const isDisabled =
            !isRequired && context?.[propertyName] === undefined

          return (
            <ContextSchema.Router
              key={propertyName}
              schema={propertySchema}
              name={propertyName}
              optional={!isRequired}
              defaultDisabled={isDisabled}
            />
          )
        }
      )}
      {children}
    </List>
  )
})

ContextSchema.String = memo(function ContextSchemaString({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'string', 'Schema must be a string')

  const { inputClassName } = useContextSchema()

  return schema.enum ? (
    <SelectInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
      options={(Array.isArray(schema.enum)
        ? schema.enum.map((value) => ({ value, label: value }))
        : Object.entries(schema.enum || {}).map(([label, value]) => ({
            value,
            label,
          }))
      ).toSorted((a, b) => {
        // @note Sort default value first, then maintain natural order
        if (a.value === schema.default) {
          return -1
        }

        if (b.value === schema.default) {
          return 1
        }

        return 0
      })}
    >
      {children}
    </SelectInput>
  ) : schema.format === 'password' ? (
    <PasswordInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </PasswordInput>
  ) : schema.format === 'multiline' ? (
    <TextAreaInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </TextAreaInput>
  ) : schema.format === 'color' ? (
    <ColorInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </ColorInput>
  ) : (
    <TextLineInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </TextLineInput>
  )
})

ContextSchema.Number = memo(function ContextSchemaNumber({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'number', 'Schema must be a number')

  const { inputClassName } = useContextSchema()

  return (
    <NumberInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </NumberInput>
  )
})

ContextSchema.Integer = memo(function ContextSchemaInteger({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'integer', 'Schema must be an integer')

  const { inputClassName } = useContextSchema()

  return (
    <NumberInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </NumberInput>
  )
})

ContextSchema.Boolean = memo(function ContextSchemaBoolean({
  schema,

  name,

  optional,

  className,

  children,

  ...props
}) {
  assert(schema.type === 'boolean', 'Schema must be a boolean')

  const { inputClassName } = useContextSchema()

  return (
    <ToggleInput
      {...props}
      {...schema['react:props']}
      className={clsx(schema['react:props']?.className, className)}
      inputClassName={clsx(
        schema['react:props']?.inputClassName,
        inputClassName
      )}
      name={name}
      label={schema.title}
      description={schema.description}
      defaultValue={schema.default}
      optional={optional}
    >
      {children}
    </ToggleInput>
  )
})

ContextSchema.Custom = (Component) =>
  memo(function ContextSchemaCustom({
    schema,

    name,

    optional,

    className,

    children,

    ...props
  }) {
    const { inputClassName } = useContextSchema() || {}

    return (
      <Component
        {...props}
        {...schema['react:props']}
        className={clsx(schema['react:props']?.className, className)}
        inputClassName={clsx(
          schema['react:props']?.inputClassName,
          inputClassName
        )}
        name={name}
        label={schema.title}
        description={schema.description}
        defaultValue={schema.default}
        optional={optional}
      >
        {children}
      </Component>
    )
  })
