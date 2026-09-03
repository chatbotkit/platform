import { useState } from 'react'

import CommaListSelect from './CommaListSelect'

export default {
  title: 'Components/CommaListSelect',
  component: CommaListSelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A reusable input component for handling comma-separated lists with drag-and-drop reordering, auto-trimming, and copy functionality.',
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: 'text',
      description: 'Default comma-separated value for uncontrolled usage',
    },
    value: {
      control: 'text',
      description: 'Controlled value (comma-separated string)',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the input field',
    },
    autoTrim: {
      control: 'boolean',
      description: 'Whether to automatically trim whitespace from items',
    },
    spellCheck: {
      control: 'boolean',
      description: 'Enable/disable spell checking on the input',
    },
    className: {
      control: 'text',
      description: 'CSS classes for styling the component',
    },
  },
}

export const Default = {
  args: {
    className: 'default-input',
    placeholder: 'Type and press Enter to add items...',
  },
}

export const WithDefaultValues = {
  args: {
    defaultValue: 'apple,banana,cherry',
    className: 'default-input',
    placeholder: 'Add more fruits...',
  },
}

export const WithStyling = {
  args: {
    defaultValue: 'React,Vue,Angular',
    className:
      'w-full p-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none',
    placeholder: 'Add frameworks...',
  },
}

const ControlledExample = (args) => {
  const [value, setValue] = useState('JavaScript,TypeScript,Python')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Programming Languages:
        </label>
        <CommaListSelect
          {...args}
          value={value}
          setValue={setValue}
          className="default-input"
          placeholder="Add programming languages..."
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">
          Current value:
          <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-2">
            {value || '(empty)'}
          </span>
        </div>

        <div className="text-sm text-gray-600">
          Items count:{' '}
          <span className="font-semibold">
            {value ? value.split(',').length : 0}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          onClick={() => setValue('Java,C++,Go')}
        >
          Set Backend Languages
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
          onClick={() => setValue('HTML,CSS,JavaScript')}
        >
          Set Frontend Languages
        </button>
        <button
          type="button"
          className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          onClick={() => setValue('')}
        >
          Clear All
        </button>
      </div>
    </div>
  )
}

export const Controlled = {
  render: ControlledExample,
  args: {},
}

export const DisabledAutoTrim = {
  args: {
    defaultValue: ' spaces , preserved , whitespace ',
    autoTrim: false,
    className: 'default-input',
    placeholder: 'Auto-trim is disabled...',
  },
}

export const EdgeCases = {
  render: () => (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4">Edge Cases</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">
              Empty strings and whitespace handling:
            </h4>
            <CommaListSelect
              defaultValue=",,, ,  ,normal"
              className="default-input"
              placeholder="Contains empty and whitespace items"
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">
              Duplicates are removed automatically:
            </h4>
            <CommaListSelect
              defaultValue="apple,banana,apple,cherry,banana,apple"
              className="default-input"
              placeholder="Duplicates will be removed"
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Long item names:</h4>
            <CommaListSelect
              defaultValue="This is a very long item name that might wrap,Short,Another really long item name that demonstrates wrapping behavior"
              className="default-input"
              placeholder="Add more items..."
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Special characters:</h4>
            <CommaListSelect
              defaultValue="@username,#hashtag,$variable,item with spaces,item-with-dashes"
              className="default-input"
              placeholder="Add items with special characters..."
            />
          </div>
        </div>
      </section>
    </div>
  ),
}

const InteractiveExample = (args) => {
  const [value, setValue] = useState('Item 1,Item 2,Item 3,Item 4,Item 5')
  const [log, setLog] = useState([])

  const addToLog = (action) => {
    setLog((prev) => [
      ...prev,
      `${action} at ${new Date().toLocaleTimeString()}`,
    ])
  }

  const handleChange = (newValue) => {
    setValue(newValue)
    addToLog(`Value changed to: "${newValue}"`)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Interactive List (try drag & drop, add/remove items):
        </label>
        <CommaListSelect
          {...args}
          value={value}
          setValue={handleChange}
          className="default-input"
          placeholder="Type and press Enter to add..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Quick Actions:</h4>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full px-3 py-2 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
              onClick={() => {
                const newItem = `Random ${Math.floor(Math.random() * 1000)}`

                setValue((prev) => (prev ? `${prev},${newItem}` : newItem))
                addToLog(`Added random item: "${newItem}"`)
              }}
            >
              Add Random Item
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
              onClick={() => {
                const items = value.split(',').filter(Boolean)

                if (items.length > 0) {
                  const shuffled = [...items].sort(() => Math.random() - 0.5)

                  setValue(shuffled.join(','))
                  addToLog('Shuffled items')
                }
              }}
            >
              Shuffle Items
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              onClick={() => {
                setValue('')
                addToLog('Cleared all items')
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Event Log:</h4>
          <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
            {log.length === 0 ? (
              <div className="text-gray-500">No events yet</div>
            ) : (
              log.slice(-10).map((entry, index) => (
                <div key={index} className="mb-1">
                  {entry}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            className="mt-2 px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
            onClick={() => setLog([])}
          >
            Clear Log
          </button>
        </div>
      </div>
    </div>
  )
}

export const Interactive = {
  render: InteractiveExample,
  args: {},
}

const FormIntegrationExample = (args) => {
  const [formData, setFormData] = useState({
    skills: 'React,JavaScript,CSS',
    interests: 'Web Development,UI Design',
    tags: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    alert(`Form submitted:\n${JSON.stringify(formData, null, 2)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Technical Skills:
        </label>
        <CommaListSelect
          {...args}
          value={formData.skills}
          setValue={(skills) => setFormData((prev) => ({ ...prev, skills }))}
          className="default-input"
          placeholder="Add your technical skills..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Areas of Interest:
        </label>
        <CommaListSelect
          {...args}
          value={formData.interests}
          setValue={(interests) =>
            setFormData((prev) => ({ ...prev, interests }))
          }
          className="default-input"
          placeholder="What are you interested in..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Tags:
        </label>
        <CommaListSelect
          {...args}
          value={formData.tags}
          setValue={(tags) => setFormData((prev) => ({ ...prev, tags }))}
          className="default-input"
          placeholder="Optional tags..."
        />
      </div>

      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Form Preview:</h4>
          <div className="text-xs bg-gray-50 p-3 rounded font-mono">
            <div>skills: {formData.skills || '(empty)'}</div>
            <div>interests: {formData.interests || '(empty)'}</div>
            <div>tags: {formData.tags || '(empty)'}</div>
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Submit Form
        </button>
      </div>
    </form>
  )
}

export const FormIntegration = {
  render: FormIntegrationExample,
  args: {},
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <CommaListSelect
          className="default-input"
          placeholder="Type and press Enter to add items..."
        />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Pre-filled Example</h3>
        <CommaListSelect
          defaultValue="Design,Development,Testing,Deployment"
          className="default-input"
          placeholder="Software development phases..."
        />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Controlled Example</h3>
        <ControlledExample />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Interactive Features</h3>
        <InteractiveExample />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Key Features</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            • ✨ <strong>Drag & Drop:</strong> Reorder items by dragging them
          </p>
          <p>
            • 🚫 <strong>Duplicate Prevention:</strong> Automatically removes
            duplicate entries
          </p>
          <p>
            • ✂️ <strong>Auto-trimming:</strong> Removes whitespace
            automatically (configurable)
          </p>
          <p>
            • 📋 <strong>Copy Function:</strong> Copy the final comma-separated
            value
          </p>
          <p>
            • 🎯 <strong>Controlled/Uncontrolled:</strong> Supports both usage
            patterns
          </p>
          <p>
            • ⌨️ <strong>Keyboard Support:</strong> Enter key to add items,
            click X to remove
          </p>
          <p>
            • 🎨 <strong>Flexible Styling:</strong> Customizable via className
            prop
          </p>
          <p>
            • 🔤 <strong>Edge Case Handling:</strong> Handles empty strings,
            whitespace, and special characters
          </p>
        </div>
      </section>
    </div>
  ),
}
