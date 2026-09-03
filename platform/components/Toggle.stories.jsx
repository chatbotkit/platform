import { useState } from 'react'

import Toggle from './Toggle'

export default {
  title: 'Components/Toggle',
  component: Toggle,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    caption: {
      control: 'text',
      description: 'Screen reader caption for the toggle',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Default checked state (uncontrolled)',
    },
    checked: {
      control: 'boolean',
      description: 'Checked state (controlled)',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the toggle is disabled',
    },
    children: {
      control: 'text',
      description: 'Label content displayed next to the toggle',
    },
  },
}

export const Default = {
  args: {},
}

export const WithLabel = {
  args: {
    children: 'Enable notifications',
    caption: 'Toggle notifications',
  },
}

export const Disabled = {
  args: {
    disabled: true,
    children: 'Disabled toggle',
  },
}

export const DisabledChecked = {
  args: {
    disabled: true,
    defaultChecked: true,
    children: 'Disabled checked toggle',
  },
}

const ControlledToggleExample = (args) => {
  const [checked, setChecked] = useState(false)

  return (
    <div className="space-y-4">
      <Toggle {...args} checked={checked} setChecked={setChecked}>
        Controlled toggle (current state: {checked ? 'ON' : 'OFF'})
      </Toggle>
      <button
        type="button"
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        onClick={() => setChecked(!checked)}
      >
        Toggle programmatically
      </button>
    </div>
  )
}

export const Controlled = {
  render: ControlledToggleExample,
  args: {
    caption: 'Controlled toggle example',
  },
}

const FormToggleExample = (args) => {
  const [checked, setChecked] = useState(false)

  return (
    <form className="space-y-4">
      <Toggle
        {...args}
        name="preferences"
        checked={checked}
        setChecked={setChecked}
      >
        Form toggle with name attribute
      </Toggle>
      <div className="text-sm text-gray-600">
        {/* @note hidden input will be included in form submission when unchecked */}
        When unchecked, a hidden input with name=&quot;preferences&quot; and
        value=&quot;off&quot; will be submitted
      </div>
    </form>
  )
}

export const WithFormName = {
  render: FormToggleExample,
  args: {
    caption: 'Form toggle with name',
  },
}

const InteractiveToggleExample = (args) => {
  const [checked, setChecked] = useState(false)
  const [log, setLog] = useState([])

  const handleChange = (newChecked) => {
    setChecked(newChecked)
    setLog((prev) => [
      ...prev,
      `Toggle changed to: ${
        newChecked ? 'ON' : 'OFF'
      } at ${new Date().toLocaleTimeString()}`,
    ])
  }

  return (
    <div className="space-y-4">
      <Toggle {...args} checked={checked} setChecked={handleChange}>
        Interactive toggle with logging
      </Toggle>

      <div className="space-y-2">
        <div className="text-sm font-medium">Event Log:</div>
        <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
          {log.length === 0 ? (
            <div className="text-gray-500">No events yet</div>
          ) : (
            log.map((entry, index) => <div key={index}>{entry}</div>)
          )}
        </div>
        <button
          type="button"
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
          onClick={() => setLog([])}
        >
          Clear Log
        </button>
      </div>
    </div>
  )
}

export const Interactive = {
  render: InteractiveToggleExample,
  args: {
    caption: 'Interactive toggle',
  },
}

export const States = {
  render: () => (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic States</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Toggle defaultChecked={false}>Unchecked</Toggle>
          </div>
          <div className="flex items-center gap-4">
            <Toggle defaultChecked={true}>Checked</Toggle>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Disabled States</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Toggle disabled defaultChecked={false}>
              Disabled unchecked
            </Toggle>
          </div>
          <div className="flex items-center gap-4">
            <Toggle disabled defaultChecked={true}>
              Disabled checked
            </Toggle>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">With Different Labels</h3>
        <div className="space-y-4">
          <Toggle defaultChecked={false}>Short label</Toggle>
          <Toggle defaultChecked={false}>
            Much longer label that demonstrates how the toggle works with
            varying text lengths
          </Toggle>
          <Toggle defaultChecked={false} caption="Custom screen reader text">
            Label with custom caption
          </Toggle>
        </div>
      </section>
    </div>
  ),
}
