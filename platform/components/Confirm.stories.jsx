/* eslint-disable import/no-anonymous-default-export */
import { useState } from 'react'

import Confirm, { useConfirm, useConfirmInput } from './Confirm'

export default {
  title: 'Components/Confirm',
  component: Confirm,
  parameters: {
    layout: 'padded',
  },
}

const ConfirmExample = () => {
  const [outcome, setOutcome] = useState('')
  const confirm = useConfirm()

  const handleBasicConfirm = async () => {
    const result = await confirm('Are you sure?')

    setOutcome(`Basic confirm result: ${result}`)
  }

  const handleCustomConfirm = async () => {
    const result = await confirm('Do you want to delete this item?', {
      actions: {
        Delete: { result: 'delete', default: false },
        Cancel: { result: false, default: true },
      },
    })

    setOutcome(`Custom confirm result: ${result}`)
  }

  const handleTitleConfirm = async () => {
    const result = await confirm({
      title: 'Important Decision',
      message: 'This action cannot be undone. Are you absolutely sure?',
    })

    setOutcome(`Title confirm result: ${result}`)
  }

  const handleMultiActionConfirm = async () => {
    const result = await confirm('What would you like to do?', {
      actions: {
        Save: { result: 'save', default: true },
        'Save & Exit': { result: 'saveAndExit', default: false },
        'Exit without saving': { result: 'exit', default: false },
        Cancel: { result: false, default: false },
      },
    })

    setOutcome(`Multi-action result: ${result}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Confirm Dialog Examples</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleBasicConfirm}
          >
            Basic Confirm
          </button>

          <button
            type="button"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={handleCustomConfirm}
          >
            Custom Actions
          </button>

          <button
            type="button"
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            onClick={handleTitleConfirm}
          >
            With Custom Title
          </button>

          <button
            type="button"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={handleMultiActionConfirm}
          >
            Multiple Actions
          </button>
        </div>
      </div>

      {outcome && (
        <div className="p-4 bg-gray-100 border border-gray-200 rounded">
          <h4 className="font-medium text-gray-800">Last Result:</h4>
          <p className="text-gray-600 mt-1">{outcome}</p>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>
          <strong>Usage:</strong> Click any button above to trigger a
          confirmation dialog.
        </p>
        <p>
          <strong>Returns:</strong> Promise that resolves with the selected
          action or false if cancelled.
        </p>
      </div>
    </div>
  )
}

export const Default = {
  render: () => (
    <Confirm>
      <ConfirmExample />
    </Confirm>
  ),
}

const BasicUsageExample = () => {
  const [result, setResult] = useState('')
  const confirm = useConfirm()

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={async () => {
          const outcome = await confirm('Are you sure?')

          setResult(`${outcome}`)
        }}
      >
        Click me
      </button>

      {result && (
        <div className="text-sm text-gray-600">
          Result:{' '}
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {result}
          </span>
        </div>
      )}
    </div>
  )
}

export const BasicUsage = {
  render: () => (
    <Confirm>
      <BasicUsageExample />
    </Confirm>
  ),
}

const CustomActionsExample = () => {
  const [result, setResult] = useState('')
  const confirm = useConfirm()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          className="block px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={async () => {
            const outcome = await confirm('Delete this item?', {
              actions: {
                Delete: { result: 'deleted', default: false },
                Cancel: { result: false, default: true },
              },
            })

            setResult(`Delete action: ${outcome}`)
          }}
        >
          Delete Item
        </button>

        <button
          type="button"
          className="block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          onClick={async () => {
            const outcome = await confirm('Choose your action:', {
              actions: {
                'Option A': { result: 'a', default: true },
                'Option B': { result: 'b', default: false },
                'Option C': { result: 'c', default: false },
              },
            })

            setResult(`Multi-choice: ${outcome}`)
          }}
        >
          Multiple Choices
        </button>
      </div>

      {result && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-800">{result}</p>
        </div>
      )}
    </div>
  )
}

export const CustomActions = {
  render: () => (
    <Confirm>
      <CustomActionsExample />
    </Confirm>
  ),
}

const TitleAndMessageExample = () => {
  const [result, setResult] = useState('')
  const confirm = useConfirm()

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        onClick={async () => {
          const outcome = await confirm({
            title: 'Important Decision',
            message:
              'This action cannot be undone. Are you absolutely sure you want to proceed?',
          })

          setResult(`Important decision: ${outcome}`)
        }}
      >
        Make Important Decision
      </button>

      {result && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
          <p className="text-purple-800">{result}</p>
        </div>
      )}
    </div>
  )
}

export const WithTitleAndMessage = {
  render: () => (
    <Confirm>
      <TitleAndMessageExample />
    </Confirm>
  ),
}

const AsyncActionsExample = () => {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const confirm = useConfirm()

  const simulateAsyncAction = async (action) => {
    setLoading(true)
    setResult(`Processing ${action}...`)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setResult(`Completed: ${action}`)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        disabled={loading}
        onClick={async () => {
          const outcome = await confirm('This will save your work. Continue?', {
            actions: {
              Save: { result: 'save', default: true },
              'Save & Publish': { result: 'saveAndPublish', default: false },
              Cancel: { result: false, default: false },
            },
          })

          if (outcome && outcome !== false) {
            await simulateAsyncAction(outcome)
          } else {
            setResult('Action cancelled')
          }
        }}
      >
        {loading ? 'Processing...' : 'Save Work'}
      </button>

      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">{result}</p>
        </div>
      )}
    </div>
  )
}

export const AsyncActions = {
  render: () => (
    <Confirm>
      <AsyncActionsExample />
    </Confirm>
  ),
}

const TextInputExample = () => {
  const [result, setResult] = useState('')
  const confirmInput = useConfirmInput()

  const handleGetUserInput = async () => {
    const data = await confirmInput(
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Please provide a description for the task:
        </p>
        <textarea
          name="description"
          className="default-input w-full"
          rows={4}
          placeholder="Enter task description..."
          required
        />
      </div>,
      {
        title: 'Create Task',
        submitButtonCaption: 'Create',
        cancelButtonCaption: 'Cancel',
      }
    )

    if (data && data.description) {
      setResult(`Task description: ${data.description}`)
    } else {
      setResult('Task creation cancelled')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        onClick={handleGetUserInput}
      >
        Create Task with Description
      </button>

      {result && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <p className="text-indigo-800 whitespace-pre-wrap">{result}</p>
        </div>
      )}

      <div className="text-sm text-gray-500 space-y-1">
        <p>
          <strong>Key points:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Use `useConfirmInput` hook for collecting form data</li>
          <li>
            Form fields with `name` attribute are collected in data object
          </li>
          <li>Promise resolves with form data on submit, false on cancel</li>
          <li>Use `required` attribute for HTML5 validation</li>
          <li>Customize button text with `submitButtonCaption`</li>
        </ul>
      </div>
    </div>
  )
}

export const WithTextInput = {
  render: () => (
    <Confirm>
      <TextInputExample />
    </Confirm>
  ),
}

const MultipleInputsExample = () => {
  const [result, setResult] = useState('')
  const confirmInput = useConfirmInput()

  const handleComplexForm = async () => {
    const data = await confirmInput(
      <div className="space-y-4">
        <div>
          <label className="default-label" htmlFor="taskTitle">
            Task Title
          </label>
          <input
            type="text"
            id="taskTitle"
            name="title"
            className="default-input w-full mt-1"
            placeholder="Enter task title..."
            required
          />
        </div>
        <div>
          <label className="default-label" htmlFor="taskDescription">
            Task Description
          </label>
          <textarea
            id="taskDescription"
            name="description"
            className="default-input w-full mt-1"
            rows={3}
            placeholder="Enter task description..."
          />
        </div>
        <div>
          <label className="default-label" htmlFor="taskPriority">
            Priority
          </label>
          <select
            id="taskPriority"
            name="priority"
            className="default-input w-full mt-1"
            defaultValue="medium"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>,
      {
        title: 'Create Task',
        submitButtonCaption: 'Create',
        cancelButtonCaption: 'Cancel',
      }
    )

    if (data && data !== false) {
      setResult(
        `Task created:\nTitle: ${data.title}\nDescription: ${
          data.description || '(none)'
        }\nPriority: ${data.priority}`
      )
    } else {
      setResult('Task creation cancelled')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
        onClick={handleComplexForm}
      >
        Create Task (Complex Form)
      </button>

      {result && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded">
          <p className="text-teal-800 whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  )
}

export const WithMultipleInputs = {
  render: () => (
    <Confirm>
      <MultipleInputsExample />
    </Confirm>
  ),
}

export const Showcase = {
  render: () => (
    <Confirm>
      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold mb-4">Basic Confirm Dialog</h3>
          <BasicUsageExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">Custom Actions</h3>
          <CustomActionsExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">Title & Message</h3>
          <TitleAndMessageExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">With Text Input</h3>
          <TextInputExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">With Multiple Inputs</h3>
          <MultipleInputsExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">Async Operations</h3>
          <AsyncActionsExample />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">Usage Notes</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              • The Confirm component provides a context for confirmation
              dialogs
            </p>
            <p>• Use the useConfirm hook to trigger confirmation dialogs</p>
            <p>• Returns a Promise that resolves with the selected action</p>
            <p>• Supports custom actions, titles, and messages</p>
            <p>
              • Canceling returns false, actions return their configured result
            </p>
            <p>
              • Use `useConfirmInput` hook to collect form data from dialogs
            </p>
          </div>
        </section>
      </div>
    </Confirm>
  ),
}
