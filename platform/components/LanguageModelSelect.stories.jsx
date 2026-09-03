/* eslint-disable import/no-anonymous-default-export */
import { useState } from 'react'

import LanguageModelSelect from './LanguageModelSelect'

export default {
  title: 'Components/LanguageModelSelect',
  component: LanguageModelSelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A component for selecting and configuring language models. Features a searchable popup dialog for model selection and a configuration popup for advanced model parameters.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'text',
      description:
        'The controlled value containing the model string with parameters',
    },
    setValue: {
      action: 'value-changed',
      description: 'Callback fired when the model value changes',
    },
    defaultValue: {
      control: 'text',
      description: 'The default model value',
    },
    name: {
      control: 'text',
      description: 'The name attribute for the hidden input field',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the component is disabled',
    },
    wrapperClassName: {
      control: 'text',
      description: 'Additional CSS classes for the wrapper',
    },
    containerClassName: {
      control: 'text',
      description: 'Additional CSS classes for the container',
    },
  },
}

export const Default = {
  args: {
    name: 'model',
    className: 'default-input w-full',
  },
}

const ControlledComponent = () => {
  const [value, setValue] = useState('gpt-4o')

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Controlled component with state management. Click on the input to open
        the model selection dialog with a searchable list of all available
        models.
      </div>
      <LanguageModelSelect
        name="model"
        value={value}
        setValue={setValue}
        className="default-input w-full"
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Current Value:</h4>
        <pre className="text-sm overflow-auto whitespace-pre-wrap break-all">
          {value || 'No model selected'}
        </pre>
      </div>
    </div>
  )
}

export const Controlled = {
  render: ControlledComponent,
}

const UncontrolledComponent = () => {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Uncontrolled component with a default value. The component manages its
        own internal state.
      </div>
      <LanguageModelSelect
        name="model"
        defaultValue="gpt-4o-mini"
        className="default-input w-full"
      />
    </div>
  )
}

export const Uncontrolled = {
  render: UncontrolledComponent,
}

const WithConfigurationComponent = () => {
  const [value, setValue] = useState('gpt-4o')

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Click the input to select a model, then click the options icon to
        configure model parameters like temperature, max tokens, etc.
      </div>
      <LanguageModelSelect
        name="model"
        value={value}
        setValue={setValue}
        className="default-input w-full"
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Current Model Configuration:</h4>
        <pre className="text-sm overflow-auto whitespace-pre-wrap break-all">
          {value || 'No model selected'}
        </pre>
      </div>
    </div>
  )
}

export const WithConfiguration = {
  render: WithConfigurationComponent,
}

const DisabledComponent = () => {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Disabled state - the input and options icon cannot be clicked.
      </div>
      <LanguageModelSelect
        name="model"
        defaultValue="gpt-4o"
        disabled
        className="default-input w-full"
      />
    </div>
  )
}

export const Disabled = {
  render: DisabledComponent,
}

const WithCustomStylingComponent = () => {
  const [value, setValue] = useState('gpt-4o')

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Custom styling applied to the component.
      </div>
      <LanguageModelSelect
        name="model"
        value={value}
        setValue={setValue}
        className="border-2 border-indigo-500 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 w-full"
        wrapperClassName="bg-indigo-50 p-4 rounded-lg"
      />
    </div>
  )
}

export const WithCustomStyling = {
  render: WithCustomStylingComponent,
}

const MultipleSelectorsComponent = () => {
  const [model1, setModel1] = useState('gpt-4o')
  const [model2, setModel2] = useState('gpt-4o-mini')
  const [model3, setModel3] = useState('claude-3.5-sonnet')

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600">
        Multiple model selectors on the same page.
      </div>

      <div className="space-y-2">
        <label className="default-label">Primary Model</label>
        <LanguageModelSelect
          name="primaryModel"
          value={model1}
          setValue={setModel1}
          className="default-input w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="default-label">Secondary Model</label>
        <LanguageModelSelect
          name="secondaryModel"
          value={model2}
          setValue={setModel2}
          className="default-input w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="default-label">Fallback Model</label>
        <LanguageModelSelect
          name="fallbackModel"
          value={model3}
          setValue={setModel3}
          className="default-input w-full"
        />
      </div>

      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Selected Models:</h4>
        <div className="text-sm space-y-1">
          <div>
            <strong>Primary:</strong> {model1}
          </div>
          <div>
            <strong>Secondary:</strong> {model2}
          </div>
          <div>
            <strong>Fallback:</strong> {model3}
          </div>
        </div>
      </div>
    </div>
  )
}

export const MultipleSelectors = {
  render: MultipleSelectorsComponent,
}

const FormIntegrationComponent = () => {
  const [formData, setFormData] = useState({
    botName: '',
    model: 'gpt-4o',
    description: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Form submitted with data:\n' + JSON.stringify(formData, null, 2))
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Example of LanguageModelSelect integrated within a form.
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="default-label" htmlFor="botName">
            Bot Name
          </label>
          <input
            id="botName"
            type="text"
            className="default-input w-full"
            value={formData.botName}
            onChange={(e) =>
              setFormData({ ...formData, botName: e.target.value })
            }
            placeholder="Enter bot name"
            required
          />
        </div>

        <div>
          <label className="default-label" htmlFor="model">
            Language Model
          </label>
          <LanguageModelSelect
            name="model"
            value={formData.model}
            setValue={(model) => setFormData({ ...formData, model })}
            className="default-input w-full"
          />
        </div>

        <div>
          <label className="default-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="default-input w-full"
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Enter bot description"
          />
        </div>

        <button type="submit" className="default-button primary">
          Create Bot
        </button>
      </form>
    </div>
  )
}

export const FormIntegration = {
  render: FormIntegrationComponent,
}

const WithResetComponent = () => {
  const [value, setValue] = useState('gpt-4o')

  const handleReset = () => {
    setValue('gpt-4o')
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Component with reset functionality to return to default model.
      </div>
      <LanguageModelSelect
        name="model"
        value={value}
        setValue={setValue}
        className="default-input w-full"
      />
      <button type="button" onClick={handleReset} className="default-button">
        Reset to Default (gpt-4o)
      </button>
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Current Model:</h4>
        <pre className="text-sm overflow-auto whitespace-pre-wrap break-all">
          {value}
        </pre>
      </div>
    </div>
  )
}

export const WithReset = {
  render: WithResetComponent,
}

const EmptyStateComponent = () => {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Component starting with no model selected. Shows the default model as
        placeholder.
      </div>
      <LanguageModelSelect
        name="model"
        value={value}
        setValue={setValue}
        className="default-input w-full"
      />
      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Current Value:</h4>
        <pre className="text-sm overflow-auto">
          {value || '(empty - will use default: gpt-4o)'}
        </pre>
      </div>
    </div>
  )
}

export const EmptyState = {
  render: EmptyStateComponent,
}
