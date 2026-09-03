import { useState } from 'react'

import useTextSelection from './useTextSelection'

export default {
  title: 'Hooks/useTextSelection',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A custom hook for tracking text selection within the document or a specific target element.',
      },
    },
  },
}

const TextSelectionDemo = ({ targetEnabled = false }) => {
  const [targetRef, setTargetRef] = useState<HTMLElement | null>(null)

  // @note passing targetRef only when targeting is enabled

  const selection = useTextSelection(
    targetEnabled ? targetRef || undefined : undefined
  )

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Text Selection Hook Demo</h3>
        <p className="text-sm text-gray-700">
          Select text in the areas below to see the hook in action.
          {targetEnabled &&
            ' Only selections in the blue box will be detected.'}
        </p>
      </div>

      {/* Selection Info Panel */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Current Selection State</h4>
        <div className="space-y-2 text-sm font-mono">
          <div>
            <span className="font-medium">Text:</span>{' '}
            <span className="text-blue-600">
              {selection.textContent ? `"${selection.textContent}"` : 'None'}
            </span>
          </div>
          <div>
            <span className="font-medium">Collapsed:</span>{' '}
            <span className="text-blue-600">
              {selection.isCollapsed?.toString() || 'undefined'}
            </span>
          </div>
          <div>
            <span className="font-medium">Coordinates:</span>
            {selection.clientRect ? (
              <div className="text-blue-600 ml-2 grid grid-cols-2 gap-x-4">
                <span>x: {selection.clientRect.x}</span>
                <span>y: {selection.clientRect.y}</span>
                <span>width: {selection.clientRect.width}</span>
                <span>height: {selection.clientRect.height}</span>
              </div>
            ) : (
              <span className="text-blue-600 ml-2">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Target Area */}
      <div
        ref={(el) => setTargetRef(el)}
        className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300"
      >
        <h4 className="font-medium mb-2">
          {targetEnabled ? 'Target Area (Active)' : 'Test Area'}
        </h4>
        <p className="mb-2">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident.
        </p>
      </div>

      {!targetEnabled && (
        <div className="bg-green-100 p-4 rounded-lg border-2 border-green-300">
          <h4 className="font-medium mb-2">Additional Test Area</h4>
          <p className="mb-2">
            This is another area for testing selections. When targeting is
            disabled, selections here should also be detected by the hook.
          </p>
          <p>
            Try selecting text across multiple paragraphs or making collapsed
            selections by just clicking without dragging.
          </p>
        </div>
      )}

      {/* Visual Selection Indicator */}
      {selection.clientRect && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
          <h4 className="font-medium mb-2">Selection Visualization</h4>
          <p className="text-sm mb-2">
            Detected selection at: ({selection.clientRect.x},{' '}
            {selection.clientRect.y}) with size {selection.clientRect.width}×
            {selection.clientRect.height}
          </p>
          <div
            className="bg-yellow-300 bg-opacity-50 border-2 border-yellow-500"
            style={{
              width: Math.max(selection.clientRect.width / 4, 20),
              height: Math.max(selection.clientRect.height / 2, 16),
            }}
          />
          <p className="text-xs text-gray-600 mt-1">
            (Scaled down for visualization)
          </p>
        </div>
      )}
    </div>
  )
}

export const Default = {
  render: () => <TextSelectionDemo />,
}

export const WithTargetConstraint = {
  render: () => <TextSelectionDemo targetEnabled={true} />,
}

export const MultipleInstances = {
  render: () => {
    const InstanceDemo = ({ title, target }) => {
      const [ref, setRef] = useState<HTMLElement | null>(null)

      const selection = useTextSelection(target ? ref || undefined : undefined)

      return (
        <div className="space-y-3">
          <h4 className="font-medium">{title}</h4>
          <div
            ref={(el) => setRef(el)}
            className="bg-gray-100 p-3 rounded border"
          >
            <p>Select text in this area. Instance: {title}</p>
          </div>
          <div className="text-sm">
            Selected: {selection.textContent || 'None'} | Collapsed:{' '}
            {selection.isCollapsed?.toString() || 'undefined'}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Multiple independent instances of the hook running simultaneously.
        </p>
        <InstanceDemo title="Instance 1 (No Target)" target={false} />
        <InstanceDemo title="Instance 2 (With Target)" target={true} />
        <InstanceDemo title="Instance 3 (With Target)" target={true} />
        <InstanceDemo title="Instance 4 (No Target)" target={false} />
      </div>
    )
  },
}

export const EdgeCases = {
  render: () => {
    const EdgeCasesDemo = () => {
      const [targetRef, setTargetRef] = useState<HTMLElement | null>(null)
      const selection = useTextSelection(targetRef || undefined)

      return (
        <div className="space-y-6">
          <div className="bg-amber-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Edge Cases Testing</h3>
            <p className="text-sm text-gray-700">
              Test various edge cases and unusual selection scenarios.
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-medium mb-2">Current Selection</h4>
            <div className="text-sm font-mono">
              Text: {selection.textContent || 'None'}
              <br />
              Collapsed: {selection.isCollapsed?.toString() || 'undefined'}
              <br />
              Coords:{' '}
              {selection.clientRect
                ? `${selection.clientRect.x},${selection.clientRect.y}`
                : 'None'}
            </div>
          </div>

          <div
            ref={(el) => setTargetRef(el)}
            className="bg-blue-100 p-4 rounded border-2 border-blue-300"
          >
            <h4 className="font-medium mb-2">Target Element</h4>

            <div className="space-y-3">
              <p>
                <strong>Test 1:</strong> Select across multiple elements with
                different styling.
                <em> This is italic text</em> and <code>this is code text</code>
                .
              </p>

              <p>
                <strong>Test 2:</strong> Try making collapsed selections by
                clicking without dragging in various parts of this text.
              </p>

              <div className="bg-white p-2 rounded">
                <strong>Test 3:</strong> Nested element selection. Try selecting
                text that spans across this nested div boundary.
              </div>

              <ul className="list-disc list-inside">
                <li>
                  <strong>Test 4:</strong> Selection in list items
                </li>
                <li>
                  Second item with{' '}
                  <a href="#" className="text-blue-600 underline">
                    a link inside
                  </a>
                </li>
                <li>Third item for testing</li>
              </ul>
            </div>
          </div>

          <div className="bg-red-100 p-4 rounded border border-red-300">
            <h4 className="font-medium mb-2">Outside Target</h4>
            <p>
              This text is outside the target element. Selections here should be
              ignored since we&apos;re using a target-constrained hook instance.
            </p>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <strong>Test Instructions:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Try selecting text that spans multiple elements</li>
              <li>Make collapsed selections (click without drag)</li>
              <li>Select text in the target vs outside areas</li>
              <li>Use keyboard selection (Shift+arrows, Ctrl+A)</li>
              <li>Try rapid selection changes</li>
              <li>Resize the browser window while text is selected</li>
            </ul>
          </div>
        </div>
      )
    }

    return <EdgeCasesDemo />
  },
}
