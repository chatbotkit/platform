import { useState } from 'react'

import PinInput from './PinInput'

export default {
  title: 'Components/PinInput',
  component: PinInput,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    defaultValue: {
      control: 'text',
      description: 'Default value for uncontrolled input',
    },
    value: {
      control: 'text',
      description: 'Controlled value',
    },
    length: {
      control: 'number',
      description: 'Number of pin input fields',
      defaultValue: 6,
    },
    name: {
      control: 'text',
      description: 'Name attribute for form submission',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the wrapper div',
    },
    containerClassName: {
      control: 'text',
      description: 'CSS classes for the pin fields container',
    },
    pinClassName: {
      control: 'text',
      description: 'CSS classes for individual pin fields',
    },
  },
}

export const Default = {
  args: {
    containerClassName: 'space-x-2',
    pinClassName: 'default-input tiny',
  },
}

export const BasicPinInput = {
  args: {
    length: 4,
    containerClassName: 'flex gap-2',
    pinClassName:
      'w-12 h-12 border border-gray-300 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
  },
}

export const SixDigitPin = {
  args: {
    length: 6,
    containerClassName: 'flex gap-3',
    pinClassName:
      'w-10 h-10 border-2 border-gray-300 rounded text-center font-mono text-lg focus:border-blue-500 focus:outline-none',
  },
}

export const StyledPin = {
  args: {
    length: 4,
    containerClassName: 'flex gap-4',
    pinClassName:
      'w-14 h-14 border-2 border-purple-300 rounded-lg text-center text-xl font-bold text-purple-700 bg-purple-50 focus:border-purple-500 focus:bg-white focus:outline-none transition-colors',
  },
}

export const CompactPin = {
  args: {
    length: 6,
    containerClassName: 'flex gap-1',
    pinClassName:
      'w-8 h-8 border border-gray-400 rounded text-center text-sm focus:border-indigo-500 focus:outline-none',
  },
}

export const WithDefaultValue = {
  args: {
    defaultValue: '1234',
    length: 4,
    containerClassName: 'flex gap-2',
    pinClassName:
      'w-12 h-12 border border-gray-300 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-green-500',
  },
}

const ControlledPinExample = (args) => {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-4">
      <PinInput {...args} value={value} setValue={setValue} />
      <div className="text-sm text-gray-600">
        Current value:{' '}
        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
          {value || '(empty)'}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm"
          onClick={() => setValue('1234')}
        >
          Set to 1234
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-gray-500 text-white rounded text-sm"
          onClick={() => setValue('')}
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export const ControlledPin = {
  render: ControlledPinExample,
  args: {
    length: 4,
    containerClassName: 'flex gap-2',
    pinClassName:
      'w-12 h-12 border border-gray-300 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
  },
}

const FormIntegrationExample = (args) => {
  const [submittedData, setSubmittedData] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()

    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    setSubmittedData(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enter PIN Code:
        </label>
        <PinInput {...args} name="pinCode" />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Submit PIN
      </button>

      {submittedData && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-medium text-green-800">Form Data:</h4>
          <pre className="text-sm text-green-700 mt-1">
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        </div>
      )}
    </form>
  )
}

export const FormIntegration = {
  render: FormIntegrationExample,
  args: {
    length: 6,
    containerClassName: 'flex gap-2',
    pinClassName:
      'w-10 h-10 border border-gray-300 rounded text-center font-mono focus:border-green-500 focus:outline-none',
  },
}

export const DifferentLengths = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">4-digit PIN</h4>
        <PinInput
          length={4}
          containerClassName="flex gap-2"
          pinClassName="w-12 h-12 border border-gray-300 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">6-digit PIN</h4>
        <PinInput
          length={6}
          containerClassName="flex gap-2"
          pinClassName="w-10 h-10 border border-gray-300 rounded text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">8-digit PIN</h4>
        <PinInput
          length={8}
          containerClassName="flex gap-1"
          pinClassName="w-8 h-8 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  ),
}

export const ThemeVariations = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium text-gray-800 mb-4">Light Theme</h4>
        <PinInput
          length={4}
          containerClassName="flex gap-3"
          pinClassName="w-12 h-12 border-2 border-gray-200 rounded-lg text-center text-lg bg-white focus:border-blue-400 focus:outline-none shadow-sm"
        />
      </div>

      <div className="bg-gray-900 p-6 rounded-lg">
        <h4 className="text-lg font-medium text-white mb-4">Dark Theme</h4>
        <PinInput
          length={4}
          containerClassName="flex gap-3"
          pinClassName="w-12 h-12 border-2 border-gray-600 rounded-lg text-center text-lg bg-gray-800 text-white focus:border-blue-400 focus:outline-none"
        />
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-800 mb-4">
          Success Theme
        </h4>
        <PinInput
          length={4}
          containerClassName="flex gap-3"
          pinClassName="w-12 h-12 border-2 border-green-300 rounded-lg text-center text-lg bg-green-50 text-green-700 focus:border-green-500 focus:outline-none"
        />
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-800 mb-4">Error Theme</h4>
        <PinInput
          length={4}
          containerClassName="flex gap-3"
          pinClassName="w-12 h-12 border-2 border-red-300 rounded-lg text-center text-lg bg-red-50 text-red-700 focus:border-red-500 focus:outline-none"
        />
      </div>
    </div>
  ),
}

const WithValidationExample = (args) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const validatePin = (pinValue) => {
    if (pinValue.length === 0) {
      setError('')

      return
    }

    if (pinValue.length < 4) {
      setError('PIN must be 4 digits')

      return
    }

    if (!/^\d+$/.test(pinValue)) {
      setError('PIN must contain only numbers')

      return
    }

    if (pinValue === '1234') {
      setError('PIN cannot be 1234')

      return
    }

    setError('')
  }

  const handleValueChange = (newValue) => {
    setValue(newValue)
    validatePin(newValue)
  }

  const isValid = value.length === 4 && !error
  const hasError = error !== ''

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enter a secure PIN:
        </label>
        <PinInput
          {...args}
          value={value}
          setValue={handleValueChange}
          pinClassName={`w-12 h-12 border-2 rounded text-center text-lg focus:outline-none ${
            hasError
              ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-500'
              : isValid
              ? 'border-green-300 bg-green-50 text-green-700 focus:border-green-500'
              : 'border-gray-300 focus:border-blue-500'
          }`}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {isValid && (
        <div className="text-sm text-green-600 flex items-center gap-1">
          <span>✅</span>
          PIN is valid
        </div>
      )}

      <div className="text-xs text-gray-500">
        Requirements: 4 digits, numbers only, not 1234
      </div>
    </div>
  )
}

export const WithValidation = {
  render: WithValidationExample,
  args: {
    length: 4,
    containerClassName: 'flex gap-2',
  },
}

export const AccessiblePin = {
  render: () => (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="accessible-pin"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Security Code <span className="text-red-500">*</span>
        </label>
        <div
          role="group"
          aria-labelledby="pin-label"
          aria-describedby="pin-help"
        >
          <PinInput
            length={6}
            containerClassName="flex gap-2"
            pinClassName="w-10 h-10 border border-gray-300 rounded text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Security code input"
          />
        </div>
        <div id="pin-help" className="text-xs text-gray-500 mt-1">
          Enter the 6-digit code sent to your phone
        </div>
      </div>
    </div>
  ),
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-gray-600">Default (4 digits):</span>
            <PinInput
              length={4}
              containerClassName="flex gap-2 mt-1"
              pinClassName="w-12 h-12 border border-gray-300 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <span className="text-sm text-gray-600">6-digit code:</span>
            <PinInput
              length={6}
              containerClassName="flex gap-2 mt-1"
              pinClassName="w-10 h-10 border border-gray-300 rounded text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Styled Variations</h3>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-gray-600">Large rounded:</span>
            <PinInput
              length={4}
              containerClassName="flex gap-3 mt-1"
              pinClassName="w-14 h-14 border-2 border-purple-300 rounded-xl text-center text-xl font-bold text-purple-700 bg-purple-50 focus:border-purple-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <span className="text-sm text-gray-600">Compact:</span>
            <PinInput
              length={6}
              containerClassName="flex gap-1 mt-1"
              pinClassName="w-8 h-8 border border-gray-400 rounded text-center text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Use Cases</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
            <PinInput
              length={6}
              containerClassName="flex gap-2"
              pinClassName="w-10 h-10 border border-gray-300 rounded text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Security PIN</h4>
            <PinInput
              length={4}
              containerClassName="flex gap-3"
              pinClassName="w-12 h-12 border-2 border-blue-300 rounded-lg text-center text-lg bg-blue-50 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Create a 4-digit security PIN
            </p>
          </div>
        </div>
      </section>
    </div>
  ),
}
