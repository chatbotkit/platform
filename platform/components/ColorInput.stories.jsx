import { useState } from 'react'

import ColorInput from './ColorInput'

export default {
  title: 'Components/ColorInput',
  component: ColorInput,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    defaultValue: {
      control: 'color',
      description: 'Default color value',
    },
    value: {
      control: 'color',
      description: 'Controlled color value',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the input',
    },
  },
}

export const Default = {
  args: {
    className: 'default-input',
  },
}

export const BasicColorInput = {
  args: {
    defaultValue: '#3b82f6',
    className: 'w-32 h-10 border border-gray-300 rounded px-3',
  },
}

export const WithDifferentColors = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Primary Color
        </label>
        <ColorInput
          defaultValue="#3b82f6"
          className="w-40 h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Success Color
        </label>
        <ColorInput
          defaultValue="#10b981"
          className="w-40 h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Warning Color
        </label>
        <ColorInput
          defaultValue="#f59e0b"
          className="w-40 h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Danger Color
        </label>
        <ColorInput
          defaultValue="#ef4444"
          className="w-40 h-10 border border-gray-300 rounded px-3"
        />
      </div>
    </div>
  ),
}

const ControlledColorExample = () => {
  const [color, setColor] = useState('#8b5cf6')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose a color:
        </label>
        <ColorInput
          value={color}
          setValue={setColor}
          className="w-40 h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">
          Current color:{' '}
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {color}
          </span>
        </div>
        <div
          className="w-20 h-10 border border-gray-300 rounded"
          style={{ backgroundColor: color }}
          title={`Preview: ${color}`}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm"
          onClick={() => setColor('#3b82f6')}
        >
          Blue
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-green-500 text-white rounded text-sm"
          onClick={() => setColor('#10b981')}
        >
          Green
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-purple-500 text-white rounded text-sm"
          onClick={() => setColor('#8b5cf6')}
        >
          Purple
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-gray-500 text-white rounded text-sm"
          onClick={() => setColor('#000000')}
        >
          Black
        </button>
      </div>
    </div>
  )
}

export const ControlledColor = {
  render: ControlledColorExample,
}

export const DisabledState = {
  args: {
    defaultValue: '#6b7280',
    disabled: true,
    className:
      'w-40 h-10 border border-gray-300 rounded px-3 opacity-50 cursor-not-allowed',
  },
}

export const DifferentSizes = {
  render: () => (
    <div className="space-y-4">
      <div>
        <span className="text-sm text-gray-600">Small:</span>
        <ColorInput
          defaultValue="#3b82f6"
          className="ml-2 w-20 h-8 border border-gray-300 rounded px-2 text-sm"
        />
      </div>

      <div>
        <span className="text-sm text-gray-600">Medium:</span>
        <ColorInput
          defaultValue="#10b981"
          className="ml-2 w-32 h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <span className="text-sm text-gray-600">Large:</span>
        <ColorInput
          defaultValue="#f59e0b"
          className="ml-2 w-40 h-12 border border-gray-300 rounded px-4 text-lg"
        />
      </div>
    </div>
  ),
}

export const StyledVariations = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Default Style
        </h4>
        <ColorInput defaultValue="#3b82f6" className="default-input" />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Rounded</h4>
        <ColorInput
          defaultValue="#10b981"
          className="w-40 h-10 border-2 border-green-300 rounded-full px-4 focus:border-green-500 focus:outline-none"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Shadow Style</h4>
        <ColorInput
          defaultValue="#8b5cf6"
          className="w-40 h-10 border border-gray-300 rounded-lg px-3 shadow-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">No Border</h4>
        <ColorInput
          defaultValue="#ef4444"
          className="w-40 h-10 bg-gray-100 rounded px-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
    </div>
  ),
}

const FormIntegrationExample = () => {
  const [formData, setFormData] = useState({
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    accentColor: '#f59e0b',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    alert(`Form submitted with colors:\n${JSON.stringify(formData, null, 2)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Primary Color
        </label>
        <ColorInput
          value={formData.primaryColor}
          setValue={(color) =>
            setFormData((prev) => ({ ...prev, primaryColor: color }))
          }
          className="w-full h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Secondary Color
        </label>
        <ColorInput
          value={formData.secondaryColor}
          setValue={(color) =>
            setFormData((prev) => ({ ...prev, secondaryColor: color }))
          }
          className="w-full h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Accent Color
        </label>
        <ColorInput
          value={formData.accentColor}
          setValue={(color) =>
            setFormData((prev) => ({ ...prev, accentColor: color }))
          }
          className="w-full h-10 border border-gray-300 rounded px-3"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <div className="flex-1 space-y-2">
          <h4 className="font-medium">Color Preview:</h4>
          <div className="flex gap-2">
            <div
              className="w-12 h-12 border border-gray-300 rounded"
              style={{ backgroundColor: formData.primaryColor }}
              title={`Primary: ${formData.primaryColor}`}
            />
            <div
              className="w-12 h-12 border border-gray-300 rounded"
              style={{ backgroundColor: formData.secondaryColor }}
              title={`Secondary: ${formData.secondaryColor}`}
            />
            <div
              className="w-12 h-12 border border-gray-300 rounded"
              style={{ backgroundColor: formData.accentColor }}
              title={`Accent: ${formData.accentColor}`}
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Save Colors
        </button>
      </div>
    </form>
  )
}

export const FormIntegration = {
  render: FormIntegrationExample,
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <ColorInput className="default-input" />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Different Colors</h3>
        <div className="flex gap-4">
          <ColorInput
            defaultValue="#3b82f6"
            className="w-32 h-10 border border-gray-300 rounded px-3"
          />
          <ColorInput
            defaultValue="#10b981"
            className="w-32 h-10 border border-gray-300 rounded px-3"
          />
          <ColorInput
            defaultValue="#f59e0b"
            className="w-32 h-10 border border-gray-300 rounded px-3"
          />
          <ColorInput
            defaultValue="#ef4444"
            className="w-32 h-10 border border-gray-300 rounded px-3"
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Controlled Example</h3>
        <ControlledColorExample />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Form Integration</h3>
        <FormIntegrationExample />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Features</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• Click to open color picker popup</p>
          <p>• Type hex values directly in the input</p>
          <p>• Visual color picker with RGBA support</p>
          <p>• Controlled and uncontrolled modes</p>
          <p>• Customizable styling via className</p>
          <p>• Disabled state support</p>
        </div>
      </section>
    </div>
  ),
}
