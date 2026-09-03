/* eslint-disable import/no-anonymous-default-export */
import { useState } from 'react'

import ObjectInput from './ObjectInput'

import { z } from 'zod'

export default {
  title: 'Components/ObjectInput',
  component: ObjectInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A textarea component for editing and validating YAML/JSON objects with optional Zod schema validation.',
      },
    },
  },
  argTypes: {
    zodSchema: {
      control: false,
      description: 'Optional Zod schema for validation',
    },
    value: {
      control: 'text',
      description: 'The controlled value of the textarea',
    },
    onChange: {
      action: 'changed',
      description: 'Callback fired when value changes',
    },
    onValidationChange: {
      action: 'validation-changed',
      description:
        'Callback fired when validation state changes. Receives (isValid: boolean, errorMessage: string)',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
    },
  },
}

export const Default = {
  args: {
    placeholder: 'Enter object in YAML format...',
  },
}

const BasicUsageComponent = () => {
  const [value, setValue] = useState('')
  const [object, setObject] = useState(null)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Basic usage without validation. Type YAML or JSON to see it parsed.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        placeholder="name: John Doe
age: 30
email: john@example.com"
        rows={4}
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Parsed Object:</h4>
        <pre className="text-sm overflow-auto">
          {object ? JSON.stringify(object, null, 2) : 'null'}
        </pre>
      </div>
    </div>
  )
}

export const BasicUsage = {
  render: BasicUsageComponent,
}

const UncontrolledBasicComponent = () => {
  const [parsedObject, setParsedObject] = useState(null)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Uncontrolled usage - the component manages its own internal state. Only
        provides defaultValue and onChange callback.
      </div>
      <ObjectInput
        defaultValue={`name: Jane Smith
age: 28
email: jane@example.com
preferences:
  theme: light
  notifications: false`}
        onChange={(_newValue) => {
          // Value changes are handled internally by the component
        }}
        setObject={setParsedObject}
        placeholder="Enter object data..."
        rows={6}
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Parsed Object (via setObject):</h4>
        <pre className="text-sm overflow-auto">
          {parsedObject ? JSON.stringify(parsedObject, null, 2) : 'null'}
        </pre>
      </div>
    </div>
  )
}

export const UncontrolledBasic = {
  render: UncontrolledBasicComponent,
}

const UncontrolledWithValidationComponent = () => {
  const [parsedObject, setParsedObject] = useState(null)
  const [isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const productSchema = z.object({
    name: z.string().min(1, 'Product name is required'),
    price: z.number().positive('Price must be positive'),
    category: z.enum(['electronics', 'clothing', 'books', 'other']),
    available: z.boolean(),
    tags: z.array(z.string()).optional(),
  })

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Uncontrolled with Zod validation - component manages its own state but
        provides validation feedback.
      </div>
      <ObjectInput
        defaultValue={`name: Wireless Mouse
price: 29.99
category: electronics
available: true
tags:
  - wireless
  - bluetooth
  - ergonomic`}
        zodSchema={productSchema}
        setObject={setParsedObject}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder="Enter product data..."
        rows={8}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Parsed Object:</h4>
          <pre className="text-sm overflow-auto">
            {parsedObject ? JSON.stringify(parsedObject, null, 2) : 'null'}
          </pre>
        </div>
        <div className="p-4 bg-blue-50 rounded">
          <h4 className="font-medium mb-2">Validation State:</h4>
          <div className="text-sm space-y-1">
            <div className={isValid ? 'text-green-600' : 'text-red-600'}>
              {isValid ? '✅ Valid' : '❌ Invalid'}
            </div>
            {errorMessage && (
              <div className="text-red-600">Error: {errorMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const UncontrolledWithValidation = {
  render: UncontrolledWithValidationComponent,
}

const WithZodValidationComponent = () => {
  const [value, setValue] = useState(`name: John Doe
age: 30
email: john@example.com`)

  const [object, setObject] = useState(null)
  const [isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const userSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(18, 'Must be at least 18 years old'),
    email: z.string().email('Must be a valid email'),
  })

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        With Zod validation. The green checkmark indicates valid data, red
        exclamation for errors.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        zodSchema={userSchema}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder="Enter user data..."
        rows={4}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Parsed Object:</h4>
          <pre className="text-sm overflow-auto">
            {object ? JSON.stringify(object, null, 2) : 'null'}
          </pre>
        </div>
        <div className="p-4 bg-blue-50 rounded">
          <h4 className="font-medium mb-2">Validation State:</h4>
          <div className="text-sm space-y-1">
            <div>Valid: {isValid ? '✅' : '❌'}</div>
            <div>Has Error: {!isValid ? '❌' : '✅'}</div>
            {errorMessage && (
              <div className="text-red-600">Error: {errorMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const WithZodValidation = {
  render: WithZodValidationComponent,
}

const ValidObjectComponent = () => {
  const [value, setValue] = useState(`name: Alice Smith
age: 25
email: alice@example.com
preferences:
  theme: dark
  notifications: true`)

  const [object, setObject] = useState(null)

  const userSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(18),
    email: z.string().email(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark']),
        notifications: z.boolean(),
      })
      .optional(),
  })

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Example with a valid object that passes Zod validation.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        zodSchema={userSchema}
        placeholder="Enter valid user data..."
        rows={6}
      />
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <h4 className="font-medium text-green-800 mb-2">✅ Valid Object</h4>
        <pre className="text-sm text-green-700 overflow-auto">
          {object ? JSON.stringify(object, null, 2) : 'null'}
        </pre>
      </div>
    </div>
  )
}

export const ValidObject = {
  render: ValidObjectComponent,
}

const InvalidObjectComponent = () => {
  const [value, setValue] = useState(`name: Bob
age: 16
email: invalid-email`)

  const [object, setObject] = useState(null)
  const [_isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const userSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(18, 'Must be at least 18'),
    email: z.string().email('Must be a valid email'),
  })

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Example with an object that fails Zod validation. Notice the red
        exclamation mark.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        zodSchema={userSchema}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder="Enter user data..."
        rows={4}
      />
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <h4 className="font-medium text-red-800 mb-2">❌ Invalid Object</h4>
        <div className="text-sm text-red-700 space-y-2">
          <div>Error: {errorMessage}</div>
          <div>Object still parsed:</div>
          <pre className="text-xs overflow-auto">
            {object ? JSON.stringify(object, null, 2) : 'null'}
          </pre>
        </div>
      </div>
    </div>
  )
}

export const InvalidObject = {
  render: InvalidObjectComponent,
}

const ZodValidationErrorsComponent = () => {
  const [currentExample, setCurrentExample] = useState(0)
  const [_isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const examples = [
    {
      name: 'Missing Required Field',
      value: `age: 25
email: test@example.com`,
      description: 'Missing the required "name" field',
    },
    {
      name: 'Age Too Low',
      value: `name: Young Person
age: 16
email: young@example.com`,
      description: 'Age is below minimum of 18',
    },
    {
      name: 'Invalid Email',
      value: `name: Test User
age: 25
email: not-an-email`,
      description: 'Email format is invalid',
    },
    {
      name: 'Wrong Data Type',
      value: `name: Test User
age: "twenty-five"
email: test@example.com`,
      description: 'Age should be a number, not a string',
    },
  ]

  const userSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(18, 'Must be at least 18 years old'),
    email: z.string().email('Must be a valid email address'),
  })

  const currentEx = examples[currentExample]

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Examples of different Zod validation errors and messages.
      </div>

      <div className="flex gap-2 flex-wrap">
        {examples.map((example, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentExample(index)}
            className={`px-3 py-1 text-sm rounded ${
              currentExample === index
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {example.name}
          </button>
        ))}
      </div>

      <ObjectInput
        key={currentExample} // Force re-render with new value
        defaultValue={currentEx.value}
        zodSchema={userSchema}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder="Enter user data..."
        rows={4}
      />

      <div className="p-4 bg-orange-50 border border-orange-200 rounded">
        <h4 className="font-medium text-orange-800 mb-2">{currentEx.name}</h4>
        <p className="text-sm text-orange-700 mb-2">{currentEx.description}</p>
        {errorMessage && (
          <div className="text-sm text-red-600 font-mono">
            Error: {errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export const ZodValidationErrors = {
  render: ZodValidationErrorsComponent,
}

const NoSchemaFallbackComponent = () => {
  const [value, setValue] = useState(`# This works without a schema
name: Test User
config:
  theme: dark
  features:
    - analytics
    - notifications
numbers: [1, 2, 3, 4, 5]`)

  const [object, setObject] = useState(null)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Without a Zod schema, the component falls back to basic YAML/JSON
        parsing with no validation indicators.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        placeholder="Enter any valid YAML/JSON..."
        rows={8}
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Parsed Object (No Validation):</h4>
        <pre className="text-sm overflow-auto">
          {object ? JSON.stringify(object, null, 2) : 'null'}
        </pre>
      </div>
    </div>
  )
}

export const NoSchemaFallback = {
  render: NoSchemaFallbackComponent,
}

const UncontrolledSimpleComponent = () => {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Simplest uncontrolled usage - just provide defaultValue and let the
        component handle everything internally.
      </div>
      <ObjectInput
        defaultValue={`# Simple configuration
title: My Application
debug: true
features:
  - authentication
  - analytics
  - caching
database:
  type: postgresql
  pool_size: 10`}
        placeholder="Enter configuration..."
        rows={10}
      />
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <h4 className="font-medium text-blue-800 mb-2">ℹ️ Simple Pattern</h4>
        <p className="text-sm text-blue-700">
          This demonstrates the simplest usage where the component manages its
          own state completely. No external state management needed.
        </p>
      </div>
    </div>
  )
}

export const UncontrolledSimple = {
  render: UncontrolledSimpleComponent,
}

const ComplexSchemaComponent = () => {
  const [value, setValue] = useState(`name: API Configuration
version: "1.2.0"
endpoints:
  - path: /users
    method: GET
    auth: required
  - path: /users
    method: POST
    auth: required
    rateLimit: 100
database:
  host: localhost
  port: 5432
  ssl: true
features:
  caching: true
  logging: true
  metrics: false`)

  const [object, setObject] = useState(null)
  const [isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const configSchema = z.object({
    name: z.string(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version'),
    endpoints: z.array(
      z.object({
        path: z.string().startsWith('/'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        auth: z.enum(['required', 'optional', 'none']),
        rateLimit: z.number().positive().optional(),
      })
    ),
    database: z.object({
      host: z.string(),
      port: z.number().min(1).max(65535),
      ssl: z.boolean(),
    }),
    features: z.object({
      caching: z.boolean(),
      logging: z.boolean(),
      metrics: z.boolean(),
    }),
  })

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Complex nested schema validation with arrays, objects, and custom
        validation rules.
      </div>
      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        zodSchema={configSchema}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder="Enter API configuration..."
        rows={12}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Validation Status:</h4>
          <div className="text-sm space-y-1">
            <div className={isValid ? 'text-green-600' : 'text-red-600'}>
              {isValid ? '✅ Valid' : '❌ Invalid'}
            </div>
            {errorMessage && (
              <div className="text-red-600 text-xs font-mono">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-blue-50 rounded">
          <h4 className="font-medium mb-2">Schema Requirements:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• name: string</li>
            <li>• version: semantic version (x.y.z)</li>
            <li>• endpoints: array of endpoint objects</li>
            <li>• database: host, port (1-65535), ssl</li>
            <li>• features: boolean flags</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export const ComplexSchema = {
  render: ComplexSchemaComponent,
}

const InteractiveExampleComponent = () => {
  const [value, setValue] = useState('')
  const [object, setObject] = useState(null)
  const [isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [schemaType, setSchemaType] = useState('user')

  const schemas = {
    user: z.object({
      name: z.string().min(1),
      age: z.number().min(0),
      email: z.string().email(),
    }),
    product: z.object({
      title: z.string().min(1),
      price: z.number().positive(),
      category: z.enum(['electronics', 'clothing', 'books']),
      inStock: z.boolean(),
    }),
    none: null,
  }

  const examples = {
    user: `name: John Doe
age: 30
email: john@example.com`,
    product: `title: Wireless Headphones
price: 99.99
category: electronics
inStock: true`,
    none: `anything: goes
here: 123
nested:
  objects: work
  arrays: [1, 2, 3]`,
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Interactive example - switch between different schemas to see validation
        in action.
      </div>

      <div className="flex gap-2">
        <select
          value={schemaType}
          onChange={(e) => {
            setSchemaType(e.target.value)
            setValue(examples[e.target.value])
          }}
          className="px-3 py-1 border rounded"
        >
          <option value="user">User Schema</option>
          <option value="product">Product Schema</option>
          <option value="none">No Schema</option>
        </select>
        <button
          type="button"
          onClick={() => setValue(examples[schemaType])}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Load Example
        </button>
      </div>

      <ObjectInput
        value={value}
        setValue={setValue}
        object={object}
        setObject={setObject}
        zodSchema={schemas[schemaType]}
        onValidationChange={(valid, error) => {
          setIsValid(valid)
          setErrorMessage(error)
        }}
        placeholder={`Enter ${
          schemaType === 'none' ? 'any object' : schemaType
        } data...`}
        rows={6}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Parsed Object:</h4>
          <pre className="text-sm overflow-auto max-h-40">
            {object ? JSON.stringify(object, null, 2) : 'null'}
          </pre>
        </div>
        <div className="p-4 bg-blue-50 rounded">
          <h4 className="font-medium mb-2">Status:</h4>
          <div className="text-sm space-y-1">
            {schemaType === 'none' ? (
              <div className="text-gray-600">
                No validation (schema not provided)
              </div>
            ) : (
              <>
                <div className={isValid ? 'text-green-600' : 'text-red-600'}>
                  {isValid ? '✅ Valid' : '❌ Invalid'}
                </div>
                {errorMessage && (
                  <div className="text-red-600 text-xs">{errorMessage}</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const InteractiveExample = {
  render: InteractiveExampleComponent,
}
