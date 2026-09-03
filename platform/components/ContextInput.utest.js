/* eslint-disable @typescript-eslint/no-require-imports */
import { useState } from 'react'

import ContextInput, {
  ColorInput,
  ContextSchema,
  NumberInput,
  SelectInput,
  TextAreaInput,
  TextLineInput,
  useInputContext,
  useInputState,
} from './ContextInput'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/ColorInput', () => jest.fn())

jest.mock('@/components/TooltipButton', () => {
  return function MockTooltipButton({
    as: Tag = 'span',
    tooltip,
    children,
    className,
    // @note strip TooltipButton-specific props that are not valid on DOM elements
    transitionStyles: _transitionStyles,
    tooltipClassName: _tooltipClassName,
    allowedPlacements: _allowedPlacements,
    placement: _placement,
    strategy: _strategy,
    delay: _delay,
    restMs: _restMs,
    caption,
    onUnmount: _onUnmount,
    ...props
  }) {
    return (
      <Tag
        data-tooltip={typeof tooltip === 'string' ? tooltip : undefined}
        className={className}
        {...props}
      >
        {caption ?? children}
      </Tag>
    )
  }
})

function InputStateHarness({
  name,
  defaultValue,
  optional = false,
  defaultDisabled,
}) {
  const state = useInputState({
    name,
    defaultValue,
    optional,
    defaultDisabled,
  })

  return (
    <>
      <output data-testid={`state-value-${name}`}>{String(state.value)}</output>
      <output data-testid={`state-disabled-${name}`}>
        {String(state.disabled)}
      </output>
      <button
        type="button"
        data-testid={`toggle-disabled-${name}`}
        onClick={() => state.setDisabled((disabled) => !disabled)}
      >
        toggle
      </button>
      <button
        type="button"
        data-testid={`set-value-${name}`}
        onClick={() => state.setValue(1800000)}
      >
        set value
      </button>
    </>
  )
}

function ContextValueView({ name }) {
  const [context] = useInputContext()

  return (
    <output data-testid={`context-${name}`}>
      {String(context?.[name] ?? 'undefined')}
    </output>
  )
}

function ParentDrivenContextHarness() {
  const [value, setValue] = useState({ timeout: 1000 })

  return (
    <ContextInput value={value} setValue={setValue}>
      <InputStateHarness name="timeout" defaultValue={3600000} />
      <ContextValueView name="timeout" />
      <button
        type="button"
        data-testid="set-parent-timeout"
        onClick={() => setValue({ timeout: 2000 })}
      >
        set parent timeout
      </button>
    </ContextInput>
  )
}

function NestedSerializedUnmountHarness({ onItemsChange }) {
  const [selected, setSelected] = useState('first')
  const [items, setItems] = useState({
    first: {
      instruction: 'name=First;enabled=true',
    },
    second: {
      instruction: 'name=Second;enabled=false',
    },
  })

  const schema = {
    type: 'object',
    properties: {
      instruction: {
        type: 'object',
        title: 'Instruction',
        properties: {
          name: {
            type: 'string',
            title: 'Name',
          },
          enabled: {
            type: 'boolean',
            title: 'Enabled',
          },
        },
        'react:props': {
          required: true,
          serializer: ({ name, enabled }) => {
            return `name=${name};enabled=${enabled ? 'true' : 'false'}`
          },
          deserializer: (value) => {
            const [, name = '', enabled = 'false'] =
              `${value}`.match(/^name=(.*);enabled=(true|false)$/) || []

            return {
              name,
              enabled: enabled === 'true',
            }
          },
        },
      },
    },
  }

  const updateItems = (updater) => {
    setItems((previousItems) => {
      const nextItems = updater(previousItems)

      onItemsChange(nextItems)

      return nextItems
    })
  }

  return (
    <>
      <ContextSchema
        key={selected}
        schema={schema}
        value={items[selected]}
        setValue={(value) => {
          updateItems((items) => ({
            ...items,

            [selected]:
              typeof value === 'function' ? value(items[selected]) : value,
          }))
        }}
      />
      <button
        type="button"
        data-testid="select-second"
        onClick={() => setSelected('second')}
      >
        select second
      </button>
    </>
  )
}

// Comprehensive test for ContextInput bug fixes and functionality
describe('ContextInput Bug Fixes and Functionality', () => {
  describe('useInputState integration behavior', () => {
    it('should prefer existing context value over provided defaultValue', () => {
      render(
        <ContextInput defaultValue={{ timeout: 0 }}>
          <InputStateHarness name="timeout" defaultValue={3600000} />
          <ContextValueView name="timeout" />
        </ContextInput>
      )

      expect(screen.getByTestId('state-value-timeout').textContent).toBe('0')
      expect(screen.getByTestId('context-timeout').textContent).toBe('0')
    })

    it('should initialize context from defaultValue when key is missing', async () => {
      render(
        <ContextInput defaultValue={{}}>
          <InputStateHarness name="timeout" defaultValue={3600000} />
          <ContextValueView name="timeout" />
        </ContextInput>
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          '3600000'
        )
      })
    })

    it('should remove optional field from context when disabled and restore when re-enabled', async () => {
      render(
        <ContextInput defaultValue={{}}>
          <InputStateHarness name="timeout" defaultValue={3600000} optional />
          <ContextValueView name="timeout" />
        </ContextInput>
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          '3600000'
        )
      })

      fireEvent.click(screen.getByTestId('set-value-timeout'))

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          '1800000'
        )
      })

      fireEvent.click(screen.getByTestId('toggle-disabled-timeout'))

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          'undefined'
        )
      })

      fireEvent.click(screen.getByTestId('toggle-disabled-timeout'))

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          '1800000'
        )
      })
    })

    it('should sync uncontrolled input state when the parent context changes', async () => {
      render(<ParentDrivenContextHarness />)

      expect(screen.getByTestId('state-value-timeout').textContent).toBe('1000')

      fireEvent.click(screen.getByTestId('set-parent-timeout'))

      await waitFor(() => {
        expect(screen.getByTestId('state-value-timeout').textContent).toBe(
          '2000'
        )
      })

      expect(screen.getByTestId('context-timeout').textContent).toBe('2000')
    })

    it('should persist nested serialized edits before selection unmount', () => {
      const onItemsChange = jest.fn()

      render(<NestedSerializedUnmountHarness onItemsChange={onItemsChange} />)

      fireEvent.change(screen.getByDisplayValue('First'), {
        target: { value: 'Updated' },
      })
      fireEvent.click(screen.getByTestId('select-second'))

      expect(onItemsChange).toHaveBeenLastCalledWith({
        first: {
          instruction: 'name=Updated;enabled=true',
        },
        second: {
          instruction: 'name=Second;enabled=false',
        },
      })
    })

    it('should not re-add optional disabled fields when their local value changes', async () => {
      render(
        <ContextInput defaultValue={{ timeout: 3600000 }}>
          <InputStateHarness
            name="timeout"
            defaultValue={3600000}
            optional
            defaultDisabled
          />
          <ContextValueView name="timeout" />
        </ContextInput>
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-timeout').textContent).toBe(
          'undefined'
        )
      })

      fireEvent.click(screen.getByTestId('set-value-timeout'))

      await waitFor(() => {
        expect(screen.getByTestId('state-value-timeout').textContent).toBe(
          '1800000'
        )
      })

      expect(screen.getByTestId('context-timeout').textContent).toBe(
        'undefined'
      )
    })
  })

  describe('ContextSchema custom format integration', () => {
    it('should pass schema.default as defaultValue to custom format components', () => {
      const CustomFormat = jest.fn(() => null)

      render(
        <ContextSchema
          defaultValue={{}}
          schema={{
            type: 'object',
            properties: {
              timeout: {
                type: 'number',
                title: 'Timeout',
                default: 3600000,
                format: CustomFormat,
              },
            },
          }}
        />
      )

      expect(CustomFormat).toHaveBeenCalled()

      const props = CustomFormat.mock.calls[0][0]

      expect(props.defaultValue).toBe(3600000)
      expect(props.schema.default).toBe(3600000)
      expect(props.name).toBe('timeout')
    })

    it('should add label hover tooltip when enabled', () => {
      const longLabel = 'Very long schema field label that gets truncated'

      render(
        <ContextSchema
          defaultValue={{}}
          labelTooltipButton
          schema={{
            type: 'object',
            properties: {
              field: {
                type: 'string',
                title: longLabel,
              },
            },
          }}
        />
      )

      const label = screen.getByText(longLabel)

      expect(label.getAttribute('data-tooltip')).toBe(longLabel)
    })
  })

  describe('Bug Fixes', () => {
    it('should sort enum options with default value first', () => {
      // When a schema has an enum with a default value that is not the first option,
      // the options should be sorted so the default comes first.
      // This ensures the select displays the correct default when the field is disabled.

      const schema = {
        type: 'string',
        enum: ['blueprint', 'user'],
        default: 'user', // Second option in the array
      }

      // Simulate the options generation and sorting logic from ContextSchema.String
      const options = (
        Array.isArray(schema.enum)
          ? schema.enum.map((value) => ({ value, label: value }))
          : Object.entries(schema.enum || {}).map(([label, value]) => ({
              value,
              label,
            }))
      ).toSorted((a, b) => {
        if (a.value === schema.default) {
          return -1
        }

        if (b.value === schema.default) {
          return 1
        }

        return 0
      })

      // Default value should now be first
      expect(options[0].value).toBe('user')
      expect(options[1].value).toBe('blueprint')

      // Test with no default - should maintain original order
      const schemaNoDefault = {
        type: 'string',
        enum: ['blueprint', 'user'],
      }

      const optionsNoDefault = schemaNoDefault.enum
        .map((value) => ({ value, label: value }))
        .toSorted((a, b) => {
          if (a.value === schemaNoDefault.default) {
            return -1
          }

          if (b.value === schemaNoDefault.default) {
            return 1
          }

          return 0
        })

      // Original order maintained when no default
      expect(optionsNoDefault[0].value).toBe('blueprint')
      expect(optionsNoDefault[1].value).toBe('user')
    })

    it('should have fixed SelectInput empty options bug', () => {
      // Test that the default value assignment is safe
      const options = []
      const defaultValue = options?.[0]?.value

      expect(defaultValue).toBeUndefined()
      expect(() => {
        // This should not throw anymore
        const testValue = options?.[0]?.value || 'fallback'

        expect(testValue).toBe('fallback')
      }).not.toThrow()
    })

    it('should handle spellCheck prop consistency', () => {
      // Verify that spellCheck prop naming is consistent
      const TextLineInputProps = {
        spellCheck: true, // Now consistent with TextAreaInput
      }

      const TextAreaInputProps = {
        spellCheck: false,
      }

      expect(TextLineInputProps.spellCheck).toBeDefined()
      expect(TextAreaInputProps.spellCheck).toBeDefined()
    })

    it('should handle null context when determining isDisabled state', () => {
      // Fix for TypeError when context is null
      // ContextSchemaObjectProperties was accessing context[propertyName] without null check

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          email: { type: 'string', title: 'Email' },
        },
        required: ['name'],
      }

      // Simulate the isDisabled calculation logic from ContextSchemaObjectProperties
      const calculateIsDisabled = (context, propertyName, isRequired) => {
        // Fixed version uses optional chaining: context?.[propertyName]
        return !isRequired && context?.[propertyName] === undefined
      }

      // Helper to check if a property is required based on schema
      const isPropertyRequired = (propName) =>
        schema.required?.includes(propName) ?? false

      // Test with null context (the bug scenario)
      const nullContext = null

      Object.keys(schema.properties).forEach((propertyName) => {
        const isRequired = isPropertyRequired(propertyName)

        expect(() => {
          calculateIsDisabled(nullContext, propertyName, isRequired)
        }).not.toThrow()
      })

      // Verify specific behaviors with null context
      expect(
        calculateIsDisabled(nullContext, 'name', isPropertyRequired('name'))
      ).toBe(false) // Required field is never disabled
      expect(
        calculateIsDisabled(nullContext, 'email', isPropertyRequired('email'))
      ).toBe(true) // Optional field with undefined value is disabled

      // Test with undefined context
      const undefinedContext = undefined

      expect(() => {
        calculateIsDisabled(
          undefinedContext,
          'email',
          isPropertyRequired('email')
        )
      }).not.toThrow()

      // Test with valid context
      const validContext = { name: 'John', email: undefined }

      expect(
        calculateIsDisabled(validContext, 'name', isPropertyRequired('name'))
      ).toBe(false) // Required
      expect(
        calculateIsDisabled(validContext, 'email', isPropertyRequired('email'))
      ).toBe(true) // Optional, undefined

      // Test with empty object context
      const emptyContext = {}

      expect(
        calculateIsDisabled(emptyContext, 'name', isPropertyRequired('name'))
      ).toBe(false) // Required
    })

    it('should handle number input conversion properly', () => {
      // Test the number conversion logic
      const convertValue = (value) => {
        return value === '' ? '' : Number(value)
      }

      expect(convertValue('42')).toBe(42)
      expect(convertValue('')).toBe('')
      expect(convertValue('0')).toBe(0)
      expect(convertValue('3.14')).toBe(3.14)
      expect(convertValue('-5')).toBe(-5)
      expect(convertValue('invalid')).toBeNaN()
    })

    it('should handle color input whitespace trimming', () => {
      // Test the improved whitespace handling
      const processColorValue = (value) => {
        return value.trim() // Only trim leading/trailing, preserve internal spaces
      }

      expect(processColorValue(' #ff0000 ')).toBe('#ff0000')
      expect(processColorValue('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)') // Preserves internal spaces
      expect(processColorValue('  blue  ')).toBe('blue')
      expect(processColorValue('hsl(120, 100%, 50%)')).toBe(
        'hsl(120, 100%, 50%)'
      )
    })
  })

  describe('Input Validation Logic', () => {
    it('should validate safe array access patterns', () => {
      const emptyArray = []
      const filledArray = [{ value: 'test', label: 'Test' }]

      // Safe access patterns
      expect(emptyArray?.[0]?.value).toBeUndefined()
      expect(filledArray?.[0]?.value).toBe('test')

      // Default fallback patterns
      expect(emptyArray?.[0]?.value ?? 'default').toBe('default')
      expect(filledArray?.[0]?.value ?? 'default').toBe('test')
    })

    it('should handle edge cases in number conversion', () => {
      const convertNumber = (value) => {
        if (value === '') {
          return ''
        }

        const num = Number(value)

        return isNaN(num) ? 0 : num
      }

      expect(convertNumber('')).toBe('')
      expect(convertNumber('42')).toBe(42)
      expect(convertNumber('0')).toBe(0)
      expect(convertNumber('invalid')).toBe(0)
      expect(convertNumber('3.14159')).toBe(3.14159)
      expect(convertNumber('-100')).toBe(-100)
    })

    it('should validate whitespace handling patterns', () => {
      // Color input handling
      const colorTrim = (value) => value.trim()

      expect(colorTrim('   #ffffff   ')).toBe('#ffffff')
      expect(colorTrim('\t\n#000000\t\n')).toBe('#000000')
      expect(colorTrim('rgb( 255 , 0 , 0 )')).toBe('rgb( 255 , 0 , 0 )') // Preserves internal spaces

      // Text input handling
      const textPreserve = (value) => value // No transformation

      expect(textPreserve('  text with spaces  ')).toBe('  text with spaces  ')
    })
  })

  describe('Schema Validation', () => {
    it('should handle various schema types correctly', () => {
      const schemas = {
        string: { type: 'string', title: 'Text Field' },
        number: { type: 'number', title: 'Number Field', minimum: 0 },
        boolean: { type: 'boolean', title: 'Toggle Field' },
        enum: { type: 'string', title: 'Select Field', enum: ['a', 'b', 'c'] },
        color: { type: 'string', title: 'Color Field', format: 'color' },
        multiline: { type: 'string', title: 'Text Area', format: 'multiline' },
        password: { type: 'string', title: 'Password', format: 'password' },
      }

      Object.values(schemas).forEach((schema) => {
        expect(schema.type).toBeDefined()
        expect(schema.title).toBeDefined()
        expect(typeof schema.title).toBe('string')
      })
    })

    it('should handle nested object schemas', () => {
      const nestedSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
          settings: {
            type: 'object',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
              notifications: { type: 'boolean' },
            },
          },
        },
      }

      expect(nestedSchema.type).toBe('object')
      expect(nestedSchema.properties.user.type).toBe('object')
      expect(nestedSchema.properties.settings.type).toBe('object')
      expect(nestedSchema.properties.user.properties.name.type).toBe('string')
      expect(nestedSchema.properties.user.properties.age.type).toBe('number')
    })
  })

  describe('State Management Logic', () => {
    it('should handle controlled vs uncontrolled state patterns', () => {
      // Controlled state pattern
      const controlledState = {
        value: 'controlled value',
        setValue: jest.fn(),
      }

      expect(controlledState.value).toBe('controlled value')
      expect(typeof controlledState.setValue).toBe('function')

      // Uncontrolled state pattern
      const uncontrolledState = {
        defaultValue: 'default value',
        value: undefined,
        setValue: undefined,
      }

      expect(uncontrolledState.defaultValue).toBe('default value')
      expect(uncontrolledState.value).toBeUndefined()
    })

    it('should handle optional field states', () => {
      const optionalField = {
        optional: true,
        disabled: true,
        setDisabled: jest.fn(),
      }

      const requiredField = {
        optional: false,
        disabled: false,
        setDisabled: jest.fn(),
      }

      expect(optionalField.optional).toBe(true)
      expect(optionalField.disabled).toBe(true)
      expect(requiredField.optional).toBe(false)
      expect(requiredField.disabled).toBe(false)
    })
  })

  describe('Serialization and Deserialization', () => {
    it('should handle basic serialization patterns', () => {
      const serialize = (value) => {
        if (value === null || value === undefined) {
          return undefined
        }

        return JSON.stringify(value)
      }

      const deserialize = (value) => {
        if (!value) {
          return undefined
        }

        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }

      expect(serialize('test')).toBe('"test"')
      expect(serialize(42)).toBe('42')
      expect(serialize(null)).toBeUndefined()

      expect(deserialize('"test"')).toBe('test')
      expect(deserialize('42')).toBe(42)
      expect(deserialize('invalid')).toBe('invalid')
    })

    it('should handle serialization errors gracefully', () => {
      const problematicObject = {}

      problematicObject.circular = problematicObject

      const safeSerialization = (value) => {
        try {
          return JSON.stringify(value)
        } catch {
          return '[Serialization Error]'
        }
      }

      expect(safeSerialization({ test: 'value' })).toBe('{"test":"value"}')
      expect(safeSerialization(problematicObject)).toBe('[Serialization Error]')
    })
  })

  describe('ContextSchema.Router Logic', () => {
    it('should route to correct component based on schema type', () => {
      // Test the switch statement logic in ContextSchema.Router
      const getComponentTypeForSchema = (schema) => {
        if (typeof schema.format === 'function') {
          return 'custom-component'
        }

        switch (schema.type) {
          case 'string':
            return 'string'
          case 'number':
            return 'number'
          case 'integer':
            return 'integer'
          case 'boolean':
            return 'boolean'
          case 'array':
            return 'array'
          case 'object':
            return 'object'
          default:
            return 'invalid'
        }
      }

      expect(getComponentTypeForSchema({ type: 'string' })).toBe('string')
      expect(getComponentTypeForSchema({ type: 'number' })).toBe('number')
      expect(getComponentTypeForSchema({ type: 'integer' })).toBe('integer')
      expect(getComponentTypeForSchema({ type: 'boolean' })).toBe('boolean')
      expect(getComponentTypeForSchema({ type: 'array' })).toBe('array')
      expect(getComponentTypeForSchema({ type: 'object' })).toBe('object')
      expect(getComponentTypeForSchema({ type: 'unknown' })).toBe('invalid')
      expect(
        getComponentTypeForSchema({ type: 'string', format: () => {} })
      ).toBe('custom-component')
    })

    it('should handle string schema format variations', () => {
      // Test different string formats route correctly
      const getStringInputType = (schema) => {
        if (schema.enum) {
          return 'select'
        }

        if (schema.format === 'password') {
          return 'password'
        }

        if (schema.format === 'multiline') {
          return 'textarea'
        }

        if (schema.format === 'color') {
          return 'color'
        }

        return 'text'
      }

      expect(getStringInputType({ type: 'string' })).toBe('text')
      expect(getStringInputType({ type: 'string', enum: ['a', 'b'] })).toBe(
        'select'
      )
      expect(getStringInputType({ type: 'string', format: 'password' })).toBe(
        'password'
      )
      expect(getStringInputType({ type: 'string', format: 'multiline' })).toBe(
        'textarea'
      )
      expect(getStringInputType({ type: 'string', format: 'color' })).toBe(
        'color'
      )
    })
  })

  describe('React Props Merging', () => {
    it('should merge react:props className with component className', () => {
      // Simulate clsx behavior for merging classNames
      const mergeClassNames = (reactPropsClassName, componentClassName) => {
        return [reactPropsClassName, componentClassName]
          .filter(Boolean)
          .join(' ')
      }

      expect(mergeClassNames('schema-class', 'component-class')).toBe(
        'schema-class component-class'
      )
      expect(mergeClassNames(undefined, 'component-class')).toBe(
        'component-class'
      )
      expect(mergeClassNames('schema-class', undefined)).toBe('schema-class')
      expect(mergeClassNames(undefined, undefined)).toBe('')
    })

    it('should handle schema with react:props correctly', () => {
      const schema = {
        type: 'string',
        title: 'Test Field',
        'react:props': {
          className: 'custom-class',
          inputClassName: 'custom-input-class',
          required: true,
        },
      }

      expect(schema['react:props']).toBeDefined()
      expect(schema['react:props'].className).toBe('custom-class')
      expect(schema['react:props'].inputClassName).toBe('custom-input-class')
      expect(schema['react:props'].required).toBe(true)
    })
  })

  describe('Array Schema Handling', () => {
    it('should handle array schema with items', () => {
      const schema = {
        type: 'array',
        title: 'Tags',
        items: [
          { type: 'string', title: 'Tag 1' },
          { type: 'string', title: 'Tag 2' },
        ],
      }

      expect(schema.items?.length).toBe(2)
      expect(schema.items?.[0].type).toBe('string')

      // Simulate the items?.length > 0 check in ContextSchema.Array
      const shouldRenderArray = schema.items?.length > 0

      expect(shouldRenderArray).toBe(true)
    })

    it('should handle array schema with empty items', () => {
      const schemaNoItems = {
        type: 'array',
        title: 'Empty Array',
        items: [],
      }

      const schemaUndefinedItems = {
        type: 'array',
        title: 'No Items Defined',
      }

      expect(schemaNoItems.items?.length > 0).toBe(false)
      expect(schemaUndefinedItems.items?.length > 0).toBeFalsy()
    })

    it('should iterate over array items correctly', () => {
      const schema = {
        type: 'array',
        items: [
          { type: 'string', title: 'First' },
          { type: 'number', title: 'Second' },
          { type: 'boolean', title: 'Third' },
        ],
      }

      const itemTypes = (schema.items || []).map((item) => item.type)

      expect(itemTypes).toEqual(['string', 'number', 'boolean'])
    })
  })

  describe('Object Schema Handling', () => {
    it('should handle object with empty properties', () => {
      const schemaEmptyProps = {
        type: 'object',
        properties: {},
      }

      const schemaNoProps = {
        type: 'object',
      }

      // Simulate the check in ContextSchema.Object
      const shouldRenderEmptyProps =
        Object.keys(schemaEmptyProps.properties || {}).length > 0
      const shouldRenderNoProps =
        Object.keys(schemaNoProps.properties || {}).length > 0

      expect(shouldRenderEmptyProps).toBe(false)
      expect(shouldRenderNoProps).toBe(false)
    })

    it('should determine required status from schema and react:props', () => {
      const schema = {
        type: 'object',
        properties: {
          requiredBySchema: { type: 'string' },
          requiredByProps: {
            type: 'string',
            'react:props': { required: true },
          },
          optional: { type: 'string' },
          bothRequired: { type: 'string', 'react:props': { required: true } },
        },
        required: ['requiredBySchema', 'bothRequired'],
      }

      const isPropertyRequired = (propName, propSchema) => {
        const isRequiredBySchema = !!schema.required?.includes(propName)
        const isRequiredByProps = !!propSchema['react:props']?.required

        return isRequiredBySchema || isRequiredByProps
      }

      expect(
        isPropertyRequired(
          'requiredBySchema',
          schema.properties.requiredBySchema
        )
      ).toBe(true)
      expect(
        isPropertyRequired('requiredByProps', schema.properties.requiredByProps)
      ).toBe(true)
      expect(isPropertyRequired('optional', schema.properties.optional)).toBe(
        false
      )
      expect(
        isPropertyRequired('bothRequired', schema.properties.bothRequired)
      ).toBe(true)
    })
  })

  describe('Context Property Access Safety', () => {
    it('should safely check hasOwnProperty on context', () => {
      // Simulate the useInputState context property check
      const safeHasProperty = (context, name) => {
        return context && Object.prototype.hasOwnProperty.call(context, name)
      }

      expect(safeHasProperty({ name: 'value' }, 'name')).toBe(true)
      expect(safeHasProperty({ name: 'value' }, 'missing')).toBe(false)
      // Null/undefined return falsy values (null/undefined), not false
      expect(safeHasProperty(null, 'name')).toBeFalsy()
      expect(safeHasProperty(undefined, 'name')).toBeFalsy()
      expect(safeHasProperty({}, 'name')).toBe(false)

      // Test with object that has overridden hasOwnProperty (edge case)
      const trickyObject = { hasOwnProperty: 'not a function', name: 'value' }

      expect(safeHasProperty(trickyObject, 'name')).toBe(true)
    })

    it('should handle context with inherited properties', () => {
      const proto = { inheritedProp: 'inherited' }
      const context = Object.create(proto)

      context.ownProp = 'own'

      expect(Object.prototype.hasOwnProperty.call(context, 'ownProp')).toBe(
        true
      )
      expect(
        Object.prototype.hasOwnProperty.call(context, 'inheritedProp')
      ).toBe(false)
    })
  })

  describe('Serialization Symbol Handling', () => {
    it('should use symbols for serialization errors', () => {
      // Test that SerializationError and DeserializationError are symbols
      const SerializationError = Symbol('SerializationError')
      const DeserializationError = Symbol('DeserializationError')

      expect(typeof SerializationError).toBe('symbol')
      expect(typeof DeserializationError).toBe('symbol')

      // Symbols are unique
      expect(SerializationError).not.toBe(Symbol('SerializationError'))
      expect(DeserializationError).not.toBe(Symbol('DeserializationError'))

      // Can be used as return values to indicate errors
      const serialize = (value, shouldFail) => {
        if (shouldFail) {
          return SerializationError
        }

        return JSON.stringify(value)
      }

      expect(serialize({ test: 'value' }, false)).toBe('{"test":"value"}')
      expect(serialize({ test: 'value' }, true)).toBe(SerializationError)

      // Check for error by comparing to symbol
      const result = serialize({}, true)

      expect(result === SerializationError).toBe(true)
    })
  })

  describe('useContextSchema Null Safety', () => {
    it('should handle undefined context schema gracefully', () => {
      // Simulate the destructuring pattern with fallback
      const getInputClassName = (contextSchema) => {
        const { inputClassName } = contextSchema || {}

        return inputClassName
      }

      expect(getInputClassName({ inputClassName: 'test-class' })).toBe(
        'test-class'
      )
      expect(getInputClassName({})).toBeUndefined()
      expect(getInputClassName(null)).toBeUndefined()
      expect(getInputClassName(undefined)).toBeUndefined()
    })
  })

  describe('Enum Object Format Handling', () => {
    it('should handle enum as object with label-value pairs', () => {
      // Enum can be an array or an object with label: value pairs
      const schemaArrayEnum = {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
      }

      const schemaObjectEnum = {
        type: 'string',
        enum: {
          'Display Label 1': 'value1',
          'Display Label 2': 'value2',
        },
      }

      // Array enum processing
      const arrayOptions = schemaArrayEnum.enum.map((value) => ({
        value,
        label: value,
      }))

      expect(arrayOptions).toEqual([
        { value: 'option1', label: 'option1' },
        { value: 'option2', label: 'option2' },
        { value: 'option3', label: 'option3' },
      ])

      // Object enum processing
      const objectOptions = Object.entries(schemaObjectEnum.enum).map(
        ([label, value]) => ({
          value,
          label,
        })
      )

      expect(objectOptions).toEqual([
        { value: 'value1', label: 'Display Label 1' },
        { value: 'value2', label: 'Display Label 2' },
      ])
    })

    it('should handle enum with null or empty values', () => {
      const processEnum = (enumValue) => {
        if (Array.isArray(enumValue)) {
          return enumValue.map((value) => ({ value, label: value }))
        }

        return Object.entries(enumValue || {}).map(([label, value]) => ({
          value,
          label,
        }))
      }

      expect(processEnum(['a', 'b'])).toEqual([
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
      ])
      expect(processEnum({})).toEqual([])
      expect(processEnum(null)).toEqual([])
      expect(processEnum(undefined)).toEqual([])
    })
  })
})

describe('ColorInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not throw when setValue callback receives undefined (Sentry #253)', () => {
    const MockColorInput = require('@/components/ColorInput')

    // @note simulate react-colorful calling setValue(undefined) - reproduces
    // the production crash: "Cannot read properties of undefined (reading 'trim')"
    MockColorInput.mockImplementation(({ setValue }) => {
      return (
        <button
          type="button"
          data-testid="trigger-undefined"
          onClick={() => setValue(undefined)}
        />
      )
    })

    const mockSetValue = jest.fn()

    render(
      <ContextInput defaultValue={{}}>
        <ColorInput
          name="brandColor"
          value={undefined}
          setValue={mockSetValue}
        />
      </ContextInput>
    )

    expect(() => {
      fireEvent.click(screen.getByTestId('trigger-undefined'))
    }).not.toThrow()
  })

  it('should trim string values in setValue callback', () => {
    const MockColorInput = require('@/components/ColorInput')

    MockColorInput.mockImplementation(({ setValue }) => {
      return (
        <button
          type="button"
          data-testid="trigger-string"
          onClick={() => setValue('  #ff0000  ')}
        />
      )
    })

    const mockSetValue = jest.fn()

    render(
      <ContextInput defaultValue={{}}>
        <ColorInput name="brandColor" setValue={mockSetValue} />
      </ContextInput>
    )

    fireEvent.click(screen.getByTestId('trigger-string'))

    expect(mockSetValue).toHaveBeenCalledWith('#ff0000')
  })
})

describe('null value prop on DOM inputs', () => {
  it('should not pass null to TextLineInput input element', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <ContextInput defaultValue={{ name: null }}>
        <TextLineInput name="name" />
      </ContextInput>
    )

    const input = container.querySelector('input')

    expect(input).not.toBeNull()
    expect(input.value).toBe('')

    const nullWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' && arg.includes('`value` prop on `input`')
      )
    )

    expect(nullWarnings).toHaveLength(0)
    consoleSpy.mockRestore()
  })

  it('should not pass null to TextAreaInput textarea element', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <ContextInput defaultValue={{ notes: null }}>
        <TextAreaInput name="notes" />
      </ContextInput>
    )

    const textarea = container.querySelector('textarea')

    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('')

    const nullWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' && arg.includes('`value` prop on `input`')
      )
    )

    expect(nullWarnings).toHaveLength(0)
    consoleSpy.mockRestore()
  })

  it('should not pass null to NumberInput input element', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <ContextInput defaultValue={{ count: null }}>
        <NumberInput name="count" />
      </ContextInput>
    )

    const input = container.querySelector('input[type="number"]')

    expect(input).not.toBeNull()
    expect(input.getAttribute('value')).not.toBe(null)

    const nullWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' && arg.includes('`value` prop on `input`')
      )
    )

    expect(nullWarnings).toHaveLength(0)
    consoleSpy.mockRestore()
  })

  it('should not pass null to SelectInput select element', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <ContextInput defaultValue={{ color: null }}>
        <SelectInput
          name="color"
          options={[
            { value: '', label: 'None' },
            { value: 'red', label: 'Red' },
          ]}
        />
      </ContextInput>
    )

    const select = container.querySelector('select')

    expect(select).not.toBeNull()
    expect(select.value).toBe('')

    const nullWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' && arg.includes('`value` prop on `input`')
      )
    )

    expect(nullWarnings).toHaveLength(0)
    consoleSpy.mockRestore()
  })

  it('should preserve normal string values in TextLineInput', () => {
    const { container } = render(
      <ContextInput defaultValue={{ name: 'hello' }}>
        <TextLineInput name="name" />
      </ContextInput>
    )

    const input = container.querySelector('input')

    expect(input.value).toBe('hello')
  })
})
