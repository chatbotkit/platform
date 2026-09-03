import { useState } from 'react'

import Collapsible from './Collapsible'

const meta = {
  title: 'Components/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'padded',
  },
}

export default meta

/**
 * Basic collapsible with toggle to test height animation
 * When disabled=false, the component calculates and animates height
 */
export const Basic = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Basic Collapsible</h3>
      <p>Toggle to see the height animation:</p>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ marginBottom: '10px' }}
      >
        {isCollapsed ? 'Show Content' : 'Hide Content'}
      </button>
      <Collapsible
        className="overflow-hidden border-2 border-blue-500 bg-blue-50 transition-all duration-300"
        style={{ height: isCollapsed ? 0 : undefined }}
      >
        <div className="p-4">
          <p className="m-0">
            This content animates smoothly when toggled. The Collapsible
            component automatically calculates and animates the height based on
            the content inside.
          </p>
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Dynamic content growth with smooth animation
 */
export const DynamicContent = () => {
  const [items, setItems] = useState([1, 2, 3])

  const addItem = () => {
    setItems((prev) => [...prev, prev.length + 1])
  }

  const removeItem = () => {
    setItems((prev) => prev.slice(0, -1))
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Dynamic Content</h3>
      <p>Add or remove items to see the height animate automatically:</p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button type="button" onClick={addItem}>
          Add Item
        </button>
        <button
          type="button"
          onClick={removeItem}
          disabled={items.length === 0}
        >
          Remove Item
        </button>
        <span style={{ alignSelf: 'center' }}>Count: {items.length}</span>
      </div>
      <Collapsible className="overflow-hidden border-2 border-green-500 bg-green-50 transition-all duration-300">
        <div className="space-y-2 p-4">
          {items.length === 0 ? (
            <p className="m-0 text-gray-500">No items</p>
          ) : (
            items.map((item) => (
              <div
                key={item}
                className="rounded border border-green-300 bg-white p-3"
              >
                <p className="m-0 font-semibold">Item #{item}</p>
                <p className="m-0 text-sm text-gray-600">
                  Content for item {item}
                </p>
              </div>
            ))
          )}
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Multiple paragraphs with smooth transitions
 */
export const MultipleParagraphs = () => {
  const [paragraphs, setParagraphs] = useState(2)

  const addParagraph = () => {
    setParagraphs((prev) => Math.min(prev + 1, 5))
  }

  const removeParagraph = () => {
    setParagraphs((prev) => Math.max(prev - 1, 1))
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Multiple Paragraphs</h3>
      <p>Add or remove paragraphs to see smooth height transitions:</p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button type="button" onClick={addParagraph} disabled={paragraphs >= 5}>
          Add Paragraph
        </button>
        <button
          type="button"
          onClick={removeParagraph}
          disabled={paragraphs <= 1}
        >
          Remove Paragraph
        </button>
        <span style={{ alignSelf: 'center' }}>Count: {paragraphs}</span>
      </div>
      <Collapsible className="overflow-hidden border-2 border-purple-500 bg-purple-50 transition-all duration-500">
        <div className="p-4">
          {Array.from({ length: paragraphs }).map((_, i) => (
            <p key={i} className={i > 0 ? 'mt-3' : 'm-0'}>
              Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur
              adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris.
            </p>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Fast transition speed
 */
export const FastTransition = () => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Fast Transition (150ms)</h3>
      <p>Quick animation for snappy interactions:</p>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ marginBottom: '10px' }}
      >
        {isCollapsed ? 'Expand ▼' : 'Collapse ▲'}
      </button>
      <Collapsible
        className="overflow-hidden border-2 border-red-500 bg-red-50 transition-all duration-150"
        style={{ height: isCollapsed ? 0 : undefined }}
      >
        <div className="p-4">
          <h4 className="m-0 mb-2 font-semibold">Fast Animation</h4>
          <p className="m-0">
            This content animates very quickly. Perfect for UI elements that
            need to respond instantly to user interaction.
          </p>
          <div className="mt-2 rounded bg-red-100 p-2">
            <p className="m-0 text-sm">Additional content block</p>
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Slow transition speed
 */
export const SlowTransition = () => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Slow Transition (1000ms)</h3>
      <p>Slow, deliberate animation:</p>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ marginBottom: '10px' }}
      >
        {isCollapsed ? 'Expand ▼' : 'Collapse ▲'}
      </button>
      <Collapsible
        className="overflow-hidden border-2 border-orange-500 bg-orange-50 transition-all duration-1000"
        style={{ height: isCollapsed ? 0 : undefined }}
      >
        <div className="p-4">
          <h4 className="m-0 mb-2 font-semibold">Slow Animation</h4>
          <p className="m-0">
            This content animates slowly over 1 second. Watch it smoothly expand
            and collapse. Great for dramatic reveals or when you want users to
            notice the animation.
          </p>
          <div className="mt-2 space-y-2">
            <div className="rounded bg-orange-100 p-2">
              <p className="m-0 text-sm">Content block 1</p>
            </div>
            <div className="rounded bg-orange-100 p-2">
              <p className="m-0 text-sm">Content block 2</p>
            </div>
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Accordion-style with multiple collapsibles
 */
export const AccordionStyle = () => {
  const [openIndex, setOpenIndex] = useState(0)

  const sections = [
    {
      title: 'Section 1',
      content:
        'This is the first section. Only one section can be open at a time, creating an accordion effect.',
    },
    {
      title: 'Section 2',
      content:
        'This is the second section. Notice how the height smoothly animates when switching between sections.',
    },
    {
      title: 'Section 3',
      content:
        'This is the third section. The Collapsible component handles all the height calculations automatically.',
    },
  ]

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Accordion Style</h3>
      <p>Click sections to see smooth transitions between items:</p>
      <div className="space-y-2">
        {sections.map((section, index) => {
          const isOpen = openIndex === index

          return (
            <div key={index} className="border-2 border-teal-500">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="w-full bg-teal-100 p-3 text-left font-semibold hover:bg-teal-200"
              >
                {section.title} {isOpen ? '▲' : '▼'}
              </button>
              <Collapsible
                className="overflow-hidden bg-teal-50 transition-all duration-300"
                style={{ height: isOpen ? undefined : 0 }}
              >
                <div className="p-4">
                  <p className="m-0">{section.content}</p>
                </div>
              </Collapsible>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Nested collapsibles
 */
export const NestedCollapsibles = () => {
  const [outerCollapsed, setOuterCollapsed] = useState(false)
  const [innerCollapsed, setInnerCollapsed] = useState(true)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Nested Collapsibles</h3>
      <p>
        Test how collapsibles work when nested inside each other. Both
        animations should work smoothly.
      </p>
      <button
        type="button"
        onClick={() => setOuterCollapsed(!outerCollapsed)}
        style={{ marginBottom: '10px' }}
      >
        {outerCollapsed ? 'Expand Outer' : 'Collapse Outer'}
      </button>
      <Collapsible
        className="overflow-hidden border-2 border-indigo-500 bg-indigo-50 transition-all duration-300"
        style={{ height: outerCollapsed ? 0 : undefined }}
      >
        <div className="p-4">
          <p className="m-0 mb-3">This is the outer collapsible content.</p>
          <button
            type="button"
            onClick={() => setInnerCollapsed(!innerCollapsed)}
            className="mb-2 rounded bg-indigo-500 px-3 py-1 text-white"
          >
            {innerCollapsed ? 'Expand Inner' : 'Collapse Inner'}
          </button>
          <Collapsible
            className="overflow-hidden border-2 border-pink-500 bg-pink-50 transition-all duration-300"
            style={{ height: innerCollapsed ? 0 : undefined }}
          >
            <div className="p-3">
              <p className="m-0 font-semibold">Inner Collapsible</p>
              <p className="m-0 mt-2 text-sm">
                This is nested inside the outer collapsible. Both heights
                animate independently and smoothly.
              </p>
            </div>
          </Collapsible>
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * With rich content (images, lists, etc)
 */
export const RichContent = () => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Rich Content</h3>
      <p>
        Test animation with complex content including lists and styled boxes:
      </p>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ marginBottom: '10px' }}
      >
        {isCollapsed ? 'Show Details ▼' : 'Hide Details ▲'}
      </button>
      <Collapsible
        className="overflow-hidden border-2 border-cyan-500 bg-cyan-50 transition-all duration-500"
        style={{ height: isCollapsed ? 0 : undefined }}
      >
        <div className="p-4">
          <h4 className="m-0 mb-3 font-bold">Product Details</h4>

          <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
            <h5 className="m-0 mb-2 text-sm font-semibold">Features</h5>
            <ul className="m-0 space-y-1 pl-5 text-sm">
              <li>Smooth height animations</li>
              <li>Automatic height calculation</li>
              <li>Responsive to content changes</li>
              <li>Customizable transition speed</li>
            </ul>
          </div>

          <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
            <h5 className="m-0 mb-2 text-sm font-semibold">Specifications</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>Type:</strong> Component
              </div>
              <div>
                <strong>Style:</strong> Animated
              </div>
              <div>
                <strong>Hook:</strong> useScrollHeight
              </div>
              <div>
                <strong>Status:</strong> Active
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-r from-cyan-100 to-cyan-200 p-3">
            <p className="m-0 text-sm font-semibold">
              💡 Perfect for FAQs, dropdowns, and expandable sections!
            </p>
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Disabled state test - when disabled, height calculation is turned off
 */
export const DisabledBehavior = () => {
  const [content, setContent] = useState('Initial content')
  const [isDisabled, setIsDisabled] = useState(false)

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3>Disabled Behavior</h3>
      <p>
        When disabled=true, the component doesn&apos;t calculate height (uses
        auto). This stops the animation behavior:
      </p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() =>
            setContent((prev) =>
              prev.length < 100
                ? prev + ' Adding more text to increase height.'
                : 'Initial content'
            )
          }
        >
          Toggle Content
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={isDisabled}
            onChange={(e) => setIsDisabled(e.target.checked)}
          />
          <span>Disable Height Calculation</span>
        </label>
      </div>
      <Collapsible
        className="overflow-hidden border-2 border-gray-500 bg-gray-50 transition-all duration-300"
        disabled={isDisabled}
      >
        <div className="p-4">
          <p className="m-0 mb-2 font-semibold">
            Status:{' '}
            {isDisabled
              ? '❌ Disabled (auto height)'
              : '✅ Enabled (calculated height)'}
          </p>
          <p className="m-0">{content}</p>
        </div>
      </Collapsible>
      <p className="mt-2 text-sm text-gray-600">
        {isDisabled
          ? 'Height calculation is disabled - no animation when content changes'
          : 'Height is being calculated and animated smoothly'}
      </p>
    </div>
  )
}
