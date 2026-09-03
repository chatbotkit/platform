import { useRef, useState } from 'react'

import useAggressiveScrollHeight from './useAggressiveScrollHeight'

const meta = {
  title: 'Hooks/useAggressiveScrollHeight',
}

export default meta

export function BasicExample() {
  const containerRef = useRef(null)
  const height = useAggressiveScrollHeight(containerRef)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">
        Basic Scroll Height Measurement
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        The hook measures the total scroll height of the container, including
        content that overflows and isn&apos;t visible.
      </p>

      <div className="mb-4 rounded-lg bg-blue-100 p-4">
        <p className="text-lg font-semibold">
          Scroll Height:{' '}
          <span className="font-mono text-blue-600">{height}px</span>
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-48 overflow-auto border-2 border-blue-500 bg-gray-50 p-4"
      >
        <div className="space-y-4">
          <p className="text-sm">
            This container has a fixed height but contains more content than can
            be displayed at once.
          </p>
          <div className="h-32 bg-gradient-to-b from-blue-200 to-blue-300 p-4">
            <p className="font-semibold">Section 1</p>
          </div>
          <div className="h-32 bg-gradient-to-b from-green-200 to-green-300 p-4">
            <p className="font-semibold">Section 2</p>
          </div>
          <div className="h-32 bg-gradient-to-b from-purple-200 to-purple-300 p-4">
            <p className="font-semibold">Section 3</p>
          </div>
          <p className="text-sm text-gray-600">
            Scroll down to see all content. The scroll height above shows the
            total content height.
          </p>
        </div>
      </div>
    </div>
  )
}

export function DynamicContentGrowth() {
  const containerRef = useRef(null)
  const [items, setItems] = useState([1, 2, 3])
  const height = useAggressiveScrollHeight(containerRef)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Dynamic Content Growth</h2>
      <p className="mb-4 text-sm text-gray-600">
        Add or remove items to see the scroll height update automatically using
        ResizeObserver and MutationObserver.
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setItems([...items, items.length + 1])}
          className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          Add Item
        </button>
        <button
          type="button"
          onClick={() => setItems(items.slice(0, -1))}
          disabled={items.length === 0}
          className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
        >
          Remove Item
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-purple-100 p-4">
        <p className="text-lg font-semibold">
          Scroll Height:{' '}
          <span className="font-mono text-purple-600">{height}px</span>
        </p>
        <p className="text-sm text-gray-600">Items: {items.length}</p>
      </div>

      <div
        ref={containerRef}
        className="h-64 overflow-auto border-2 border-purple-500 bg-gray-50 p-4"
      >
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item}
              className="rounded border-2 border-purple-300 bg-purple-50 p-4"
            >
              <p className="font-semibold">Item #{item}</p>
              <p className="text-sm text-gray-600">
                This is some content for item {item}
              </p>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center text-gray-500">No items. Add some!</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function DisabledState() {
  const containerRef = useRef(null)
  const [disabled, setDisabled] = useState(false)
  const height = useAggressiveScrollHeight(containerRef, disabled)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Disabled State</h2>
      <p className="mb-4 text-sm text-gray-600">
        When disabled is true, the hook returns &apos;auto&apos; and stops
        observing changes. Try toggling it and adding content.
      </p>

      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">Disable Hook</span>
        </label>
      </div>

      <div className="mb-4 rounded-lg bg-orange-100 p-4">
        <p className="text-lg font-semibold">
          Scroll Height:{' '}
          <span className="font-mono text-orange-600">
            {disabled ? 'disabled (auto)' : `${height}px`}
          </span>
        </p>
        <p className="text-sm text-gray-600">
          Status: {disabled ? '❌ Disabled' : '✅ Active'}
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-48 overflow-auto border-2 border-orange-500 bg-gray-50 p-4"
      >
        <div className="space-y-4">
          <p className="text-sm">
            {disabled
              ? 'Hook is disabled - height will not update'
              : 'Hook is active - height updates automatically'}
          </p>
          <div className="h-32 bg-orange-200 p-4">Content Block 1</div>
          <div className="h-32 bg-orange-300 p-4">Content Block 2</div>
          <div className="h-32 bg-orange-400 p-4">Content Block 3</div>
        </div>
      </div>
    </div>
  )
}

export function ExpandableContent() {
  const containerRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const height = useAggressiveScrollHeight(containerRef)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Expandable Content</h2>
      <p className="mb-4 text-sm text-gray-600">
        Toggle content visibility to see how the hook tracks height changes in
        real-time.
      </p>

      <div className="mb-4 rounded-lg bg-teal-100 p-4">
        <p className="text-lg font-semibold">
          Scroll Height:{' '}
          <span className="font-mono text-teal-600">{height}px</span>
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-64 overflow-auto border-2 border-teal-500 bg-gray-50 p-4"
      >
        <div className="space-y-4">
          <div className="rounded bg-teal-100 p-4">
            <h3 className="font-semibold">Expandable Section</h3>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 rounded bg-teal-500 px-3 py-1 text-sm text-white hover:bg-teal-600"
            >
              {expanded ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>

          {expanded && (
            <>
              <div className="rounded bg-gradient-to-r from-teal-200 to-teal-300 p-4">
                <h4 className="font-semibold">Additional Content 1</h4>
                <p className="mt-2 text-sm">
                  This content appears when expanded and increases the scroll
                  height.
                </p>
              </div>
              <div className="rounded bg-gradient-to-r from-teal-300 to-teal-400 p-4">
                <h4 className="font-semibold">Additional Content 2</h4>
                <p className="mt-2 text-sm">
                  The hook automatically detects this change through
                  MutationObserver.
                </p>
              </div>
              <div className="rounded bg-gradient-to-r from-teal-400 to-teal-500 p-4">
                <h4 className="font-semibold text-white">
                  Additional Content 3
                </h4>
                <p className="mt-2 text-sm text-white">
                  All height changes are tracked seamlessly.
                </p>
              </div>
            </>
          )}

          <div className="rounded bg-teal-50 p-4">
            <p className="text-sm text-gray-600">
              Current state: {expanded ? 'Expanded' : 'Collapsed'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MultipleContainers() {
  const container1Ref = useRef(null)
  const container2Ref = useRef(null)
  const container3Ref = useRef(null)

  const height1 = useAggressiveScrollHeight(container1Ref)
  const height2 = useAggressiveScrollHeight(container2Ref)
  const height3 = useAggressiveScrollHeight(container3Ref)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Multiple Containers</h2>
      <p className="mb-4 text-sm text-gray-600">
        The hook can track scroll height for multiple elements simultaneously.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="mb-2 rounded bg-red-100 p-2 text-center">
            <p className="text-sm font-semibold">
              Height: <span className="font-mono">{height1}px</span>
            </p>
          </div>
          <div
            ref={container1Ref}
            className="h-40 overflow-auto border-2 border-red-500 bg-gray-50 p-3"
          >
            <div className="space-y-2">
              <div className="h-16 bg-red-200 p-2">
                <p className="text-xs font-semibold">Container 1</p>
              </div>
              <div className="h-16 bg-red-300 p-2">
                <p className="text-xs">Content Block</p>
              </div>
              <div className="h-16 bg-red-400 p-2">
                <p className="text-xs">More Content</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 rounded bg-blue-100 p-2 text-center">
            <p className="text-sm font-semibold">
              Height: <span className="font-mono">{height2}px</span>
            </p>
          </div>
          <div
            ref={container2Ref}
            className="h-40 overflow-auto border-2 border-blue-500 bg-gray-50 p-3"
          >
            <div className="space-y-2">
              <div className="h-24 bg-blue-200 p-2">
                <p className="text-xs font-semibold">Container 2</p>
              </div>
              <div className="h-24 bg-blue-300 p-2">
                <p className="text-xs">Larger Block</p>
              </div>
              <div className="h-24 bg-blue-400 p-2">
                <p className="text-xs">Even More</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 rounded bg-green-100 p-2 text-center">
            <p className="text-sm font-semibold">
              Height: <span className="font-mono">{height3}px</span>
            </p>
          </div>
          <div
            ref={container3Ref}
            className="h-40 overflow-auto border-2 border-green-500 bg-gray-50 p-3"
          >
            <div className="space-y-2">
              <div className="h-12 bg-green-200 p-2">
                <p className="text-xs font-semibold">Container 3</p>
              </div>
              <div className="h-12 bg-green-300 p-2">
                <p className="text-xs">Small Blocks</p>
              </div>
              <div className="h-12 bg-green-400 p-2">
                <p className="text-xs">Short Content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TextareaAutoGrow() {
  const textareaRef = useRef(null)
  const [text, setText] = useState('Type something...')
  const height = useAggressiveScrollHeight(textareaRef)

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Textarea Auto-Grow Use Case</h2>
      <p className="mb-4 text-sm text-gray-600">
        A common use case: tracking textarea scroll height to implement
        auto-growing text inputs.
      </p>

      <div className="mb-4 rounded-lg bg-indigo-100 p-4">
        <p className="text-lg font-semibold">
          Content Height:{' '}
          <span className="font-mono text-indigo-600">{height}px</span>
        </p>
        <p className="text-sm text-gray-600">
          Type or paste text to see the height adjust
        </p>
      </div>

      <div className="rounded border-2 border-indigo-500 bg-white p-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ height }}
          className="w-full resize-none overflow-hidden border-none p-2 focus:outline-none"
          placeholder="Start typing..."
        />
      </div>

      <div className="mt-4 space-x-2">
        <button
          type="button"
          onClick={() =>
            setText(
              'Short text to see the height decrease when content is removed.'
            )
          }
          className="rounded bg-indigo-500 px-3 py-1 text-sm text-white hover:bg-indigo-600"
        >
          Set Short Text
        </button>
        <button
          type="button"
          onClick={() =>
            setText(
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum.'
            )
          }
          className="rounded bg-indigo-500 px-3 py-1 text-sm text-white hover:bg-indigo-600"
        >
          Set Long Text
        </button>
      </div>
    </div>
  )
}

export function WindowResizeTracking() {
  const containerRef = useRef(null)
  const height = useAggressiveScrollHeight(containerRef)
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  )

  // Track window width for display purposes
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      setWindowWidth(window.innerWidth)
    })
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Window Resize Tracking</h2>
      <p className="mb-4 text-sm text-gray-600">
        The hook listens to window resize events. Resize your browser window to
        see how the scroll height adjusts when content reflows.
      </p>

      <div className="mb-4 rounded-lg bg-pink-100 p-4">
        <p className="text-lg font-semibold">
          Scroll Height:{' '}
          <span className="font-mono text-pink-600">{height}px</span>
        </p>
        <p className="text-sm text-gray-600">Window Width: {windowWidth}px</p>
      </div>

      <div
        ref={containerRef}
        className="h-56 overflow-auto border-2 border-pink-500 bg-gray-50 p-4"
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold">Responsive Content</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div
                key={num}
                className="rounded bg-gradient-to-br from-pink-200 to-pink-300 p-4"
              >
                <p className="font-semibold">Card {num}</p>
                <p className="text-xs">
                  This grid changes layout based on screen size, affecting the
                  total scroll height.
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Resize the window to see the grid reflow and height update
          </p>
        </div>
      </div>
    </div>
  )
}
