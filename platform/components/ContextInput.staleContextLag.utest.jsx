import { useEffect, useRef, useState } from 'react'

import { ContextSchema, useInputState } from './ContextInput'

import { act, fireEvent, render, screen } from '@testing-library/react'

// @note this format component lets us spy on every value the field renders
// with, so we can assert that a stale context snapshot does NOT briefly
// overwrite the just-typed local value (the live designer's "letter appears
// on the next keystroke" symptom).
const valueRenderLog = []

function SpyStringField({ schema, name, optional }) {
  const state = useInputState({
    name,
    optional,
    defaultValue: schema.default ?? '',
  })

  valueRenderLog.push(state.value)

  return (
    <input
      data-testid={`field-${name}`}
      value={state.value ?? ''}
      onChange={(event) => state.setValue(event.target.value)}
    />
  )
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name', format: SpyStringField },
  },
  required: ['name'],
}

// @note simulates the React Flow store's one-render delay between local
// commit and the prop coming back into the configurator subtree.
function StaleContextHarness({ initial }) {
  const [truth, setTruth] = useState(initial)
  const [view, setView] = useState(initial)

  const setValueRef = useRef((updater) => {
    setTruth((prev) =>
      typeof updater === 'function' ? updater(prev) : updater
    )
  })

  useEffect(() => {
    if (truth !== view) {
      setView(truth)
    }
  }, [truth, view])

  return (
    <ContextSchema
      schema={schema}
      value={view}
      setValue={setValueRef.current}
    />
  )
}

describe('stale context does not roll back the locally-typed value', () => {
  beforeEach(() => {
    valueRenderLog.length = 0
  })

  it('never renders the field with a value older than the most recent keystroke', () => {
    render(<StaleContextHarness initial={{ name: 'a' }} />)

    valueRenderLog.length = 0

    act(() => {
      fireEvent.change(screen.getByTestId('field-name'), {
        target: { value: 'ab' },
      })
    })

    // @note no render after the keystroke should show "a" - if it does, that
    // is the live designer's stale-context regression where effect 1 overwrites
    // the just-typed value because context arrived one render late.
    const stalePostCommitRenders = valueRenderLog.filter((v) => v === 'a')

    expect(stalePostCommitRenders).toHaveLength(0)
    expect(valueRenderLog.at(-1)).toBe('ab')
    expect(screen.getByTestId('field-name').value).toBe('ab')
  })

  it('still applies a genuine external value change', () => {
    function ExternallyDriven() {
      const [data, setData] = useState({ name: 'a' })

      return (
        <>
          <button type="button" onClick={() => setData({ name: 'external' })}>
            external rename
          </button>
          <ContextSchema schema={schema} value={data} setValue={setData} />
        </>
      )
    }

    render(<ExternallyDriven />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'external rename' }))
    })

    expect(screen.getByTestId('field-name').value).toBe('external')
  })
})
