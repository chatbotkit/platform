import { useMemo, useState } from 'react'

import useControlledState from './useControlledState'

const meta = {
  title: 'Hooks/useControlledState',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Interactive stories for controlled and uncontrolled useControlledState behavior, including the controlled updater burst path that previously lagged behind user input.',
      },
    },
  },
}

export default meta

function StoryLayout({ title, description, children }) {
  return (
    <div className="max-w-3xl space-y-4 p-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      {children}
    </div>
  )
}

function StatePanel({ label, value }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <pre className="mt-2 overflow-auto text-sm text-gray-900">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function UncontrolledStringHarness() {
  const [value, setValue, initialValue] = useControlledState(
    'uncontrolled start',
    undefined,
    undefined
  )

  return (
    <div className="space-y-4">
      <input
        className="default-input w-full"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <StatePanel label="Current Value" value={value} />
        <StatePanel label="Initial Value" value={initialValue} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="default-button"
          type="button"
          onClick={() => setValue('manual update')}
        >
          Set Manual Value
        </button>
        <button
          className="default-button"
          type="button"
          onClick={() => setValue((prev) => `${prev}!`)}
        >
          Append !
        </button>
      </div>
    </div>
  )
}

function ControlledStringHarness() {
  const [parentValue, setParentValue] = useState('controlled start')
  const [value, setValue, initialValue] = useControlledState(
    'ignored initial',
    parentValue,
    setParentValue
  )

  return (
    <div className="space-y-4">
      <input
        className="default-input w-full"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatePanel label="Hook Value" value={value} />
        <StatePanel label="Parent Value" value={parentValue} />
        <StatePanel label="Initial Value" value={initialValue} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="default-button"
          type="button"
          onClick={() => setParentValue('parent overwrite')}
        >
          Parent Overwrite
        </button>
        <button
          className="default-button"
          type="button"
          onClick={() => setValue((prev) => `${prev} + hook`)}
        >
          Hook Function Update
        </button>
      </div>
    </div>
  )
}

function ControlledUpdaterBurstHarness() {
  const [parentValue, setParentValue] = useState('')
  const [value, setValue] = useControlledState('', parentValue, setParentValue)

  const expectedValue = 'tes'
  const isExpected = value === expectedValue && parentValue === expectedValue

  return (
    <div className="space-y-4">
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Use the button below to dispatch three function updaters in a single
        event. If this hook regresses, the result usually collapses to the last
        character instead of accumulating the full string.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="default-button"
          type="button"
          onClick={() => {
            setParentValue('')
          }}
        >
          Reset
        </button>
        <button
          className="default-button"
          type="button"
          onClick={() => {
            setParentValue('')

            setValue((prev) => prev + 't')
            setValue((prev) => prev + 'e')
            setValue((prev) => prev + 's')
          }}
        >
          Run Updater Burst
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatePanel label="Hook Value" value={value} />
        <StatePanel label="Parent Value" value={parentValue} />
      </div>

      <div
        className={[
          'rounded border p-3 text-sm',
          isExpected
            ? 'border-green-200 bg-green-50 text-green-900'
            : 'border-red-200 bg-red-50 text-red-900',
        ].join(' ')}
      >
        Expected: {expectedValue}
        <br />
        Actual: {value || '(empty)'}
      </div>
    </div>
  )
}

function ControlledObjectHarness() {
  const [parentValue, setParentValue] = useState({
    name: '',
    enabled: true,
  })

  const [value, setValue] = useControlledState({}, parentValue, setParentValue)

  const nestedSetters = useMemo(() => {
    return {
      name: (nextValue) => {
        setValue((prev) => ({
          ...prev,
          name:
            typeof nextValue === 'function' ? nextValue(prev.name) : nextValue,
        }))
      },
      enabled: (nextValue) => {
        setValue((prev) => ({
          ...prev,
          enabled:
            typeof nextValue === 'function'
              ? nextValue(prev.enabled)
              : nextValue,
        }))
      },
    }
  }, [setValue])

  return (
    <div className="space-y-4">
      <input
        className="default-input w-full"
        type="text"
        value={value.name}
        onChange={(event) => nestedSetters.name(event.target.value)}
        placeholder="Type quickly here"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => nestedSetters.enabled(event.target.checked)}
        />
        Enabled
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="default-button"
          type="button"
          onClick={() => {
            setParentValue({ name: '', enabled: true })
          }}
        >
          Reset Object
        </button>
        <button
          className="default-button"
          type="button"
          onClick={() => {
            nestedSetters.name((prev) => prev + 't')
            nestedSetters.name((prev) => prev + 'e')
            nestedSetters.name((prev) => prev + 's')
          }}
        >
          Burst Name Update
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatePanel label="Hook Object" value={value} />
        <StatePanel label="Parent Object" value={parentValue} />
      </div>
    </div>
  )
}

export function UncontrolledString() {
  return (
    <StoryLayout
      title="Uncontrolled String"
      description="Basic local state behavior. Type in the input or trigger function updates to see the hook mutate its own internal value."
    >
      <UncontrolledStringHarness />
    </StoryLayout>
  )
}

export function ControlledString() {
  return (
    <StoryLayout
      title="Controlled String"
      description="The hook mirrors parent state and forwards updates back to the parent setter."
    >
      <ControlledStringHarness />
    </StoryLayout>
  )
}

export function ControlledUpdaterBurst() {
  return (
    <StoryLayout
      title="Controlled Updater Burst"
      description="This is the smallest reproducer for the lagging-character bug. One click dispatches three function updaters before the parent rerenders."
    >
      <ControlledUpdaterBurstHarness />
    </StoryLayout>
  )
}

export function ControlledObject() {
  return (
    <StoryLayout
      title="Controlled Nested Object"
      description="Mirrors the nested object updater pattern used by configurators. Type in the field or run the burst update to verify object merges stay in order."
    >
      <ControlledObjectHarness />
    </StoryLayout>
  )
}
