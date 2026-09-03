import { useState } from 'react'

import ImageModelSelect from './ImageModelSelect'

const meta = {
  title: 'Components/ImageModelSelect',
  component: ImageModelSelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A searchable image model selector component with configuration options.',
      },
    },
  },
}

export default meta

function DefaultExample() {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="default-label">Image Model</label>
        <ImageModelSelect
          className="default-input w-full"
          value={value}
          setValue={setValue}
        />
      </div>
      <div className="text-sm text-gray-600">
        Selected value: <code>{value || 'none'}</code>
      </div>
    </div>
  )
}

export const Default = {
  render: () => <DefaultExample />,
}

export const WithDefaultValue = {
  render: () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="default-label">Image Model</label>
          <ImageModelSelect
            className="default-input w-full"
            defaultValue="openai/dall-e-3"
          />
        </div>
      </div>
    )
  },
}

export const Disabled = {
  render: () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="default-label">Image Model (Disabled)</label>
          <ImageModelSelect
            className="default-input w-full"
            defaultValue="openai/dall-e-3"
            disabled
          />
        </div>
      </div>
    )
  },
}

function InFormExample() {
  const [formData, setFormData] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()

    const data = new FormData(e.target)

    setFormData(Object.fromEntries(data.entries()))
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="default-label" htmlFor="name">
            Name
          </label>
          <input
            className="default-input w-full"
            name="name"
            type="text"
            defaultValue="My Image Generator"
          />
        </div>
        <div>
          <label className="default-label">Image Model</label>
          <ImageModelSelect
            className="default-input w-full"
            name="model"
            defaultValue="openai/dall-e-3"
          />
        </div>
        <button type="submit" className="primary-button">
          Submit
        </button>
      </form>
      {formData && (
        <div className="text-sm">
          <strong>Form Data:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export const InForm = {
  render: () => <InFormExample />,
}

function ComparisonExample() {
  const [value, setValue] = useState('')

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4">
        <h3 className="font-medium">Uncontrolled (defaultValue)</h3>
        <div>
          <label className="default-label">Image Model</label>
          <ImageModelSelect
            className="default-input w-full"
            defaultValue="openai/dall-e-3"
          />
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="font-medium">Controlled (value/setValue)</h3>
        <div>
          <label className="default-label">Image Model</label>
          <ImageModelSelect
            className="default-input w-full"
            value={value}
            setValue={setValue}
          />
        </div>
        <div className="text-sm text-gray-600">
          Value: <code>{value || 'none'}</code>
        </div>
      </div>
    </div>
  )
}

export const Comparison = {
  render: () => <ComparisonExample />,
}
