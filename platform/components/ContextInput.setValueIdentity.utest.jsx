import { useEffect, useState } from 'react'

import { ContextSchema, useInputState } from './ContextInput'

import { fireEvent, render, screen } from '@testing-library/react'

// @note this test reproduces the live designer "Maximum update depth exceeded"
// loop that happens when the configurator opens for a node that contains a
// complex field (e.g. MetaInput -> ObjectInput) whose internal useEffect
// depends on a setter coming from useInputState.
//
// Before the fix, useInputState's setValue useCallback included `value` in its
// deps. Each keystroke produced a new setValue identity that propagated down
// into the downstream component's useEffect deps. That effect re-ran and
// synchronously emitted a freshly constructed object back up the chain,
// closing the loop.

let downstreamRenderCount = 0
let downstreamSetterIdentities = new Set()

// @note simulates ObjectInput's behaviour: it owns local string state, parses
// it on change via a useEffect, and pushes the parsed object back to the
// parent setter. The setter identity is tracked so we can prove churn.
function FakeObjectInput({ object, setObject }) {
  downstreamRenderCount += 1
  downstreamSetterIdentities.add(setObject)

  const [text, setText] = useState(() => JSON.stringify(object ?? {}))

  useEffect(() => {
    let parsed

    try {
      parsed = JSON.parse(text)
    } catch {
      return
    }

    // @note always emit a fresh reference, mirroring ObjectInput which calls
    // parse() and feeds the new object up via setObject.
    setObject(parsed)
  }, [text, setObject])

  return (
    <textarea
      data-testid="object-text"
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  )
}

// @note a custom format component wired through ContextSchema, mirroring the
// MetaFormatComponent -> MetaInput -> ObjectInput path used in the designer.
function MetaLikeFormat({ schema, name, optional }) {
  const state = useInputState({ name, optional, defaultValue: {} })

  return (
    <div>
      <FakeObjectInput object={state.value} setObject={state.setValue} />
    </div>
  )
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' },
    meta: { type: 'object', title: 'Meta', format: MetaLikeFormat },
  },
  required: ['name'],
}

function Harness({ initialValue }) {
  const [value, setValue] = useState(initialValue)

  return (
    <>
      <div data-testid="snapshot">{JSON.stringify(value)}</div>
      <ContextSchema schema={schema} value={value} setValue={setValue} />
    </>
  )
}

describe('useInputState setValue identity stability', () => {
  beforeEach(() => {
    downstreamRenderCount = 0
    downstreamSetterIdentities = new Set()
  })

  it('does not produce a new setValue identity on every keystroke', () => {
    render(<Harness initialValue={{ name: 'a', meta: { x: 1 } }} />)

    const initialIdentities = downstreamSetterIdentities.size
    const initialRenders = downstreamRenderCount

    fireEvent.change(screen.getByDisplayValue('a'), {
      target: { value: 'ab' },
    })

    // @note allow effects to settle. If setValue's identity churned on each
    // value change, FakeObjectInput's useEffect would re-fire, push a new
    // object up, which would change context, which would re-render and produce
    // yet another setter identity, etc.
    const trailingIdentities = downstreamSetterIdentities.size
    const trailingRenders = downstreamRenderCount

    // eslint-disable-next-line no-console
    console.log(
      'downstream setter identities:',
      trailingIdentities,
      'downstream renders:',
      trailingRenders - initialRenders
    )

    expect(trailingIdentities - initialIdentities).toBeLessThanOrEqual(1)
    expect(trailingRenders - initialRenders).toBeLessThan(20)
  })
})
