import { useState } from 'react'

import {
  ColorInput,
  ContextInput,
  ContextSchema,
  InputContextProvider,
  NumberInput,
  SelectInput,
  TextLineInput,
  ToggleInput,
} from './ContextInput'

const meta = {
  title: 'Components/ContextInput',
  component: ContextInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A comprehensive input context system for managing form state and schema-driven form generation.',
      },
    },
  },
}

export default meta

export const BasicForm = {
  render: function BasicFormStory() {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      age: 25,
      newsletter: true,
      favoriteColor: '#3b82f6',
    })

    return (
      <InputContextProvider value={formData} setValue={setFormData}>
        <div className="space-y-4 max-w-md">
          <h3 className="text-lg font-semibold">User Profile Form</h3>

          <TextLineInput
            name="name"
            label="Full Name"
            description="Enter your full name"
            placeholder="John Doe"
          />

          <TextLineInput
            name="email"
            label="Email Address"
            description="Your email address"
            placeholder="john@example.com"
          />

          <NumberInput
            name="age"
            label="Age"
            description="Your age in years"
            min={18}
            max={100}
          />

          <ToggleInput
            name="newsletter"
            label="Subscribe to Newsletter"
            description="Receive weekly updates and tips"
          />

          <ColorInput
            name="favoriteColor"
            label="Favorite Color"
            description="Pick your favorite color"
          />

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h4 className="text-sm font-medium mb-2">Form Data:</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </InputContextProvider>
    )
  },
}

// Schema-Driven Form Examples

export const SchemaForm = {
  render: function SchemaFormStory() {
    const [formData, setFormData] = useState({})

    const schema = {
      type: 'object',
      title: 'User Settings',
      properties: {
        username: {
          type: 'string',
          title: 'Username',
          description: 'Your unique username',
        },
        email: {
          type: 'string',
          title: 'Email',
          description: 'Your email address',
          format: 'email',
        },
        bio: {
          type: 'string',
          title: 'Biography',
          description: 'Tell us about yourself',
          format: 'multiline',
        },
        theme: {
          type: 'string',
          title: 'Theme',
          description: 'Choose your preferred theme',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
          title: 'Enable Notifications',
          description: 'Receive notifications about updates',
        },
        maxItems: {
          type: 'number',
          title: 'Max Items',
          description: 'Maximum number of items to show',
          minimum: 1,
          maximum: 100,
        },
        brandColor: {
          type: 'string',
          title: 'Brand Color',
          description: 'Your brand color',
          format: 'color',
        },
      },
      required: ['username', 'email'],
    }

    return (
      <div className="max-w-md">
        <ContextSchema
          schema={schema}
          value={formData}
          setValue={setFormData}
        />

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="text-sm font-medium mb-2">Form Data:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      </div>
    )
  },
}

export const NestedSchemaForm = {
  render: function NestedSchemaFormStory() {
    const [formData, setFormData] = useState({})

    const schema = {
      type: 'object',
      title: 'Project Configuration',
      properties: {
        project: {
          type: 'object',
          title: 'Project Details',
          properties: {
            name: {
              type: 'string',
              title: 'Project Name',
            },
            description: {
              type: 'string',
              title: 'Description',
              format: 'multiline',
            },
          },
          required: ['name'],
        },
        settings: {
          type: 'object',
          title: 'Settings',
          properties: {
            debug: {
              type: 'boolean',
              title: 'Debug Mode',
            },
            timeout: {
              type: 'number',
              title: 'Timeout (seconds)',
              minimum: 1,
              maximum: 300,
            },
            environment: {
              type: 'string',
              title: 'Environment',
              enum: ['development', 'staging', 'production'],
            },
          },
        },
      },
    }

    return (
      <div className="max-w-lg">
        <ContextSchema
          schema={schema}
          value={formData}
          setValue={setFormData}
        />

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="text-sm font-medium mb-2">Form Data:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      </div>
    )
  },
}

export const NestedSchemaIsolation = {
  render: function NestedSchemaIsolationStory() {
    const [formData, setFormData] = useState({
      requiredGroup: {
        name: 'Required group',
      },
      serializedGroup: 'name=Serialized group;enabled=true',
    })

    const schema = {
      type: 'object',
      title: 'Nested Schema Isolation',
      properties: {
        optionalGroup: {
          type: 'object',
          title: 'Optional Group',
          properties: {
            name: {
              type: 'string',
              title: 'Name',
            },
          },
        },
        requiredGroup: {
          type: 'object',
          title: 'Required Group',
          properties: {
            name: {
              type: 'string',
              title: 'Name',
            },
          },
        },
        serializedGroup: {
          type: 'object',
          title: 'Serialized Group',
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
      required: ['requiredGroup'],
    }

    return (
      <div className="max-w-lg">
        <ContextSchema
          schema={schema}
          value={formData}
          setValue={setFormData}
        />

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="text-sm font-medium mb-2">Form Data:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      </div>
    )
  },
}

export const NestedSchemaUnmountIsolation = {
  render: function NestedSchemaUnmountIsolationStory() {
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
      title: 'Configurator',
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

    const selectedItem = items[selected]

    return (
      <div className="max-w-lg space-y-4">
        <div className="flex gap-2">
          {Object.keys(items).map((id) => (
            <button
              key={id}
              className="default-button tiny"
              type="button"
              onClick={() => setSelected(id)}
            >
              {id}
            </button>
          ))}
        </div>

        <ContextSchema
          key={selected}
          schema={schema}
          value={selectedItem}
          setValue={(value) => {
            setItems((items) => ({
              ...items,

              [selected]:
                typeof value === 'function' ? value(items[selected]) : value,
            }))
          }}
        />

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="text-sm font-medium mb-2">Items:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(items, null, 2)}
          </pre>
        </div>
      </div>
    )
  },
}

// Error States and Edge Cases

export const OptionalFields = {
  render: function OptionalFieldsStory() {
    const [formData, setFormData] = useState({})

    return (
      <InputContextProvider value={formData} setValue={setFormData}>
        <div className="space-y-4 max-w-md">
          <h3 className="text-lg font-semibold">Optional Fields Demo</h3>

          <TextLineInput
            name="requiredField"
            label="Required Field"
            description="This field is always enabled"
            optional={false}
          />

          <TextLineInput
            name="optionalField"
            label="Optional Field"
            description="This field can be enabled/disabled"
            optional={true}
            defaultDisabled={true}
          />

          <NumberInput
            name="optionalNumber"
            label="Optional Number"
            description="Optional numeric field"
            optional={true}
            defaultDisabled={true}
            min={0}
            max={100}
          />

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h4 className="text-sm font-medium mb-2">Form Data:</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </InputContextProvider>
    )
  },
}

export const EmptySelectOptions = {
  render: function EmptySelectOptionsStory() {
    const [formData, setFormData] = useState({})

    return (
      <InputContextProvider value={formData} setValue={setFormData}>
        <div className="space-y-4 max-w-md">
          <h3 className="text-lg font-semibold">Edge Cases Demo</h3>

          <SelectInput
            name="empty"
            label="Empty Options (Fixed)"
            description="This select has no options but won't crash"
            options={[]}
            defaultValue=""
          />

          <SelectInput
            name="single"
            label="Single Option"
            description="Select with one option"
            options={[{ value: 'only', label: 'Only Option' }]}
          />

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h4 className="text-sm font-medium mb-2">Form Data:</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </InputContextProvider>
    )
  },
}
