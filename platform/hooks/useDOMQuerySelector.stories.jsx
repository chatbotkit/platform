import { useEffect, useRef, useState } from 'react'

import useDOMQuerySelector from './useDOMQuerySelector'

const meta = {
  title: 'Hooks/useDOMQuerySelector',
  parameters: {
    layout: 'padded',
  },
}

export default meta

// Helper component to display results
function ResultDisplay({ elements, label }) {
  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        background: '#f5f5f5',
        borderRadius: '4px',
      }}
    >
      <h4 style={{ margin: '0 0 0.5rem 0' }}>{label}</h4>
      <div>
        <strong>Found {elements.length} element(s)</strong>
        {elements.length > 0 && (
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
            {elements.map((el, idx) => (
              <li key={idx}>
                {el.tagName.toLowerCase()}
                {el.className ? `.${el.className.split(' ').join('.')}` : ''}
                {el.id ? `#${el.id}` : ''}
                {el.textContent
                  ? ` - "${el.textContent.slice(0, 30)}${
                      el.textContent.length > 30 ? '...' : ''
                    }"`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Story 1: Basic usage - elements exist immediately
export const ElementsExist = () => {
  const elements = useDOMQuerySelector('.test-element')

  return (
    <div>
      <h3>Elements Exist Immediately</h3>
      <p>These elements are rendered before the hook runs.</p>

      <div className="test-element">Test Element 1</div>
      <div className="test-element">Test Element 2</div>
      <div className="test-element">Test Element 3</div>

      <ResultDisplay elements={elements} label="Query Result" />
    </div>
  )
}

// Story 2: Wait for elements to appear
export const WaitForElements = () => {
  const [showElements, setShowElements] = useState(false)
  const elements = useDOMQuerySelector('.delayed-element', {
    waitForElements: true,
  })

  return (
    <div>
      <h3>Wait For Elements</h3>
      <p>Elements appear after a delay. The hook waits for them.</p>

      <button
        type="button"
        onClick={() => setShowElements(true)}
        style={{
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Show Elements
      </button>

      {showElements && (
        <>
          <div className="delayed-element">Delayed Element 1</div>
          <div className="delayed-element">Delayed Element 2</div>
        </>
      )}

      <ResultDisplay elements={elements} label="Query Result" />
    </div>
  )
}

// Story 3: No waiting - elements don't exist
export const NoWaitNoElements = () => {
  const [showElements, setShowElements] = useState(false)
  const elements = useDOMQuerySelector('.missing-element', {
    waitForElements: false,
  })

  return (
    <div>
      <h3>No Wait - Elements Don&apos;t Exist</h3>
      <p>
        Elements don&apos;t exist initially and we&apos;re not waiting for them.
      </p>

      <button
        type="button"
        onClick={() => setShowElements(true)}
        style={{
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Show Elements (won&apos;t be detected)
      </button>

      {showElements && (
        <>
          <div className="missing-element">This won&apos;t be detected</div>
          <div className="missing-element">Because we&apos;re not waiting</div>
        </>
      )}

      <ResultDisplay elements={elements} label="Query Result" />
    </div>
  )
}

// Story 4: Disconnect on first match
export const DisconnectOnFirstMatch = () => {
  const [count, setCount] = useState(0)
  const elements = useDOMQuerySelector('.dynamic-element', {
    waitForElements: true,
    disconnectOnFirstMatch: true,
  })

  return (
    <div>
      <h3>Disconnect On First Match</h3>
      <p>
        Observer disconnects after finding the first element(s). New elements
        won&apos;t be detected.
      </p>

      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        style={{
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '0.5rem',
        }}
      >
        Add Element (count: {count})
      </button>

      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="dynamic-element">
          Dynamic Element {idx + 1}
        </div>
      ))}

      <ResultDisplay elements={elements} label="Query Result" />
      <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
        Note: After the first element appears, the observer stops watching.
        Additional elements won&apos;t update the count.
      </p>
    </div>
  )
}

// Story 5: Keep observing (disconnectOnFirstMatch: false)
export const KeepObserving = () => {
  const [count, setCount] = useState(0)
  const elements = useDOMQuerySelector('.observed-element', {
    waitForElements: true,
    disconnectOnFirstMatch: false,
  })

  return (
    <div>
      <h3>Keep Observing</h3>
      <p>Observer continues watching even after finding elements.</p>

      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        style={{
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '0.5rem',
        }}
      >
        Add Element (count: {count})
      </button>

      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="observed-element">
          Observed Element {idx + 1}
        </div>
      ))}

      <ResultDisplay elements={elements} label="Query Result" />
      <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
        Note: The observer keeps watching, so new elements are detected as
        they&apos;re added.
      </p>
    </div>
  )
}

// Story 6: Custom parent element
export const CustomParent = () => {
  const parentRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  const elements = useDOMQuerySelector('.child-element', {
    parent: parentRef.current,
    waitForElements: false,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div>
      <h3>Custom Parent Element</h3>
      <p>
        Query within a specific parent element instead of the entire document.
      </p>

      <div
        ref={parentRef}
        style={{
          padding: '1rem',
          border: '2px solid #0070f3',
          borderRadius: '4px',
          marginTop: '1rem',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Parent Container</h4>
        <div className="child-element">Child 1</div>
        <div className="child-element">Child 2</div>
      </div>

      <div
        style={{
          marginTop: '1rem',
          padding: '1rem',
          border: '2px solid #ccc',
          borderRadius: '4px',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Outside Parent</h4>
        <div className="child-element">This won&apos;t be found</div>
      </div>

      {mounted && <ResultDisplay elements={elements} label="Query Result" />}
    </div>
  )
}

// Story 7: Changing selector dynamically
export const DynamicSelector = () => {
  const [selector, setSelector] = useState('.type-a')
  const elements = useDOMQuerySelector(selector)

  return (
    <div>
      <h3>Dynamic Selector</h3>
      <p>Change the selector to query different elements.</p>

      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setSelector('.type-a')}
          style={{
            padding: '0.5rem 1rem',
            background: selector === '.type-a' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '0.5rem',
          }}
        >
          Query .type-a
        </button>
        <button
          type="button"
          onClick={() => setSelector('.type-b')}
          style={{
            padding: '0.5rem 1rem',
            background: selector === '.type-b' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '0.5rem',
          }}
        >
          Query .type-b
        </button>
        <button
          type="button"
          onClick={() => setSelector('[data-custom]')}
          style={{
            padding: '0.5rem 1rem',
            background: selector === '[data-custom]' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Query [data-custom]
        </button>
      </div>

      <div className="type-a">Type A Element 1</div>
      <div className="type-a">Type A Element 2</div>
      <div className="type-b">Type B Element 1</div>
      <div className="type-b">Type B Element 2</div>
      <div className="type-b">Type B Element 3</div>
      <div data-custom="true">Custom Attribute Element</div>

      <ResultDisplay
        elements={elements}
        label={`Query Result for "${selector}"`}
      />
    </div>
  )
}

// Story 8: Complex selector
export const ComplexSelector = () => {
  const elements = useDOMQuerySelector(
    'div.box[data-active="true"]:not(.disabled)'
  )

  return (
    <div>
      <h3>Complex Selector</h3>
      <p>
        Using a complex CSS selector:{' '}
        <code>div.box[data-active=&quot;true&quot;]:not(.disabled)</code>
      </p>

      <div className="box" data-active="true">
        ✓ Matches (box + active)
      </div>
      <div className="box" data-active="false">
        ✗ No match (not active)
      </div>
      <div className="box disabled" data-active="true">
        ✗ No match (disabled)
      </div>
      <div className="other" data-active="true">
        ✗ No match (not a box)
      </div>
      <div className="box" data-active="true">
        ✓ Matches (box + active)
      </div>

      <ResultDisplay elements={elements} label="Query Result" />
    </div>
  )
}

// Story 9: Performance test with many elements
export const PerformanceTest = () => {
  const [elementCount, setElementCount] = useState(10)
  const [useWait, setUseWait] = useState(false)

  const elements = useDOMQuerySelector('.perf-element', {
    waitForElements: useWait,
  })

  return (
    <div>
      <h3>Performance Test</h3>
      <p>Test with many elements to observe performance.</p>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="checkbox"
            checked={useWait}
            onChange={(e) => setUseWait(e.target.checked)}
          />{' '}
          Wait for elements
        </label>
        <label>
          Count: {elementCount}
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={elementCount}
            onChange={(e) => setElementCount(Number(e.target.value))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>

      <div
        style={{
          maxHeight: '200px',
          overflow: 'auto',
          border: '1px solid #ccc',
          padding: '0.5rem',
        }}
      >
        {Array.from({ length: elementCount }).map((_, idx) => (
          <div key={idx} className="perf-element" style={{ padding: '2px' }}>
            Element {idx + 1}
          </div>
        ))}
      </div>

      <ResultDisplay elements={elements} label="Query Result" />
    </div>
  )
}
