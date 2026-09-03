import { useState } from 'react'

import GlobalRoot from '@/components/GlobalRoot'

import TextSelectionTools from './TextSelectionTools'

export default {
  title: 'Components/TextSelectionTools',
  component: TextSelectionTools,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A component that renders tools above or below selected text using a portal.',
      },
    },
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'center', 'right'],
      description: 'Horizontal positioning of the tools relative to selection',
    },
    placement: {
      control: 'select',
      options: ['auto', 'top', 'bottom'],
      description: 'Vertical placement of the tools relative to selection',
    },
    offset: {
      control: 'number',
      description: 'Distance in pixels between selection and tools',
    },
    delay: {
      control: 'number',
      description: 'Delay in milliseconds before showing tools after selection',
    },
  },
  decorators: [
    (Story) => (
      <div>
        <GlobalRoot />
        <Story />
      </div>
    ),
  ],
}

const DemoTextArea = ({ target, children, ...textSelectProps }) => {
  const [ref, setRef] = useState(null)

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800 mb-2">
          <strong>Instructions:</strong> Select text in the area below to see
          the TextSelectionTools in action.
        </p>
        <p className="text-xs text-yellow-600">
          The tools will appear when you select text and disappear when you
          click elsewhere.
        </p>
      </div>
      <div
        ref={(el) => setRef(el)}
        className="p-6 border border-gray-300 rounded-lg bg-white"
        style={{ minHeight: '200px', userSelect: 'text' }}
      >
        <h3 className="text-lg font-semibold mb-4">Sample Text Content</h3>
        <p className="mb-4">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
        <p className="mb-4">
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident, sunt in culpa qui officia deserunt mollit anim id est
          laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem
          accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae
          ab illo inventore veritatis et quasi architecto beatae vitae dicta
          sunt explicabo.
        </p>
      </div>
      <TextSelectionTools target={target ? ref : null} {...textSelectProps}>
        {children}
      </TextSelectionTools>
    </div>
  )
}

const defaultToolsRenderer = (text) => (
  <div className="flex items-center gap-2 p-2 bg-white border border-gray-300 rounded-lg shadow-lg">
    <button
      type="button"
      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      onClick={() => navigator.clipboard?.writeText(text)}
    >
      Copy
    </button>
    <button
      type="button"
      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
      onClick={() => alert(`Selected: "${text}"`)}
    >
      Quote
    </button>
    <button
      type="button"
      className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
      onClick={() => alert(`Searching for: "${text}"`)}
    >
      Search
    </button>
    <div className="px-2 py-1 text-xs text-gray-500 border-l border-gray-200">
      {text.length} chars
    </div>
  </div>
)

export const Default = {
  render: (args) => (
    <DemoTextArea target={true} {...args}>
      {defaultToolsRenderer}
    </DemoTextArea>
  ),
  args: {
    position: 'center',
    placement: 'auto',
    offset: 8,
    delay: 0,
  },
}

export const Positioning = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Center Positioning</h3>
        <DemoTextArea target={true} position="center">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
      <section>
        <h3 className="text-lg font-semibold mb-4">Left Positioning</h3>
        <DemoTextArea target={true} position="left">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
      <section>
        <h3 className="text-lg font-semibold mb-4">Right Positioning</h3>
        <DemoTextArea target={true} position="right">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
    </div>
  ),
}

export const Placement = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Auto Placement</h3>
        <p className="text-sm text-gray-600 mb-4">
          Tools appear above or below based on available space
        </p>
        <DemoTextArea target={true} placement="auto">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
      <section>
        <h3 className="text-lg font-semibold mb-4">Force Top Placement</h3>
        <DemoTextArea target={true} placement="top">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
      <section>
        <h3 className="text-lg font-semibold mb-4">Force Bottom Placement</h3>
        <DemoTextArea target={true} placement="bottom">
          {defaultToolsRenderer}
        </DemoTextArea>
      </section>
    </div>
  ),
}

export const CustomTools = {
  render: () => (
    <DemoTextArea target={true}>
      {({ text }) => (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl">
          <div className="text-xs text-gray-400 mb-2">Selected Text:</div>
          <div className="text-sm mb-3 max-w-xs truncate">
            &ldquo;{text}&rdquo;
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-700"
              onClick={() => alert(`Highlight: ${text}`)}
            >
              Highlight
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700"
              onClick={() => alert(`Translate: ${text}`)}
            >
              Translate
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700"
              onClick={() => alert(`Define: ${text}`)}
            >
              Define
            </button>
          </div>
        </div>
      )}
    </DemoTextArea>
  ),
}

export const WithoutTarget = {
  render: () => (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800 mb-2">
          <strong>Global Selection:</strong> This demo works with text selection
          anywhere on the page.
        </p>
        <p className="text-xs text-blue-600">
          Try selecting text in this description or anywhere else on the page.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border border-gray-200 rounded">
          <h4 className="font-semibold mb-2">Column 1</h4>
          <p className="text-sm">
            This is some sample text in the first column. You can select any
            part of this text and see the tools appear.
          </p>
        </div>
        <div className="p-4 border border-gray-200 rounded">
          <h4 className="font-semibold mb-2">Column 2</h4>
          <p className="text-sm">
            This is some sample text in the second column. Selection works here
            too since we&rsquo;re not restricting to a target element.
          </p>
        </div>
      </div>
      <TextSelectionTools target={null}>
        {({ text }) => (
          <div className="flex items-center gap-2 p-2 bg-purple-100 border border-purple-300 rounded shadow-lg">
            <span className="text-xs text-purple-700">Global selection:</span>
            <span className="text-sm font-medium text-purple-900 max-w-xs truncate">
              &ldquo;{text}&rdquo;
            </span>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
              onClick={() => alert(`Global selection: "${text}"`)}
            >
              Action
            </button>
          </div>
        )}
      </TextSelectionTools>
    </div>
  ),
}

export const MultipleSelections = {
  render: () => (
    <div className="space-y-4">
      <DemoTextArea target={true}>
        {({ text }) => (
          <div className="flex items-center gap-2 p-2 bg-blue-100 border border-blue-300 rounded shadow-lg">
            <span className="text-xs text-blue-700">Selection 1:</span>
            <span className="text-sm font-medium text-blue-900 max-w-xs truncate">
              &ldquo;{text}&rdquo;
            </span>
          </div>
        )}
      </DemoTextArea>
      <DemoTextArea target={true}>
        {({ text }) => (
          <div className="flex items-center gap-2 p-2 bg-green-100 border border-green-300 rounded shadow-lg">
            <span className="text-xs text-green-700">Selection 2:</span>
            <span className="text-sm font-medium text-green-900 max-w-xs truncate">
              &ldquo;{text}&rdquo;
            </span>
          </div>
        )}
      </DemoTextArea>
    </div>
  ),
}

export const LargeOffset = {
  render: () => (
    <DemoTextArea target={true} offset={24}>
      {({ text }) => (
        <div className="p-3 bg-orange-100 border border-orange-300 rounded-lg">
          <div className="text-sm text-orange-800">
            Large offset demo: &ldquo;{text}&rdquo;
          </div>
          <button
            type="button"
            className="mt-2 px-3 py-1 text-sm bg-orange-500 text-white rounded"
          >
            Action
          </button>
        </div>
      )}
    </DemoTextArea>
  ),
}

export const WithDelay = {
  render: () => (
    <div className="space-y-12">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800 mb-2">
          <strong>Note:</strong> Each section below has its own isolated
          TextSelectionTools instance.
        </p>
        <p className="text-xs text-yellow-600">
          Selecting text in one section should only show tools for that section.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-4">No Delay (Immediate)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Tools appear instantly when text is selected
        </p>
        <DemoTextArea target={true} delay={0}>
          {({ text }) => (
            <div className="flex items-center gap-2 p-2 bg-green-100 border border-green-300 rounded shadow-lg">
              <span className="text-xs text-green-700">Immediate:</span>
              <span className="text-sm font-medium text-green-900 max-w-xs truncate">
                &ldquo;{text}&rdquo;
              </span>
            </div>
          )}
        </DemoTextArea>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">500ms Delay</h3>
        <p className="text-sm text-gray-600 mb-4">
          Tools appear after a half-second delay
        </p>
        <DemoTextArea target={true} delay={500}>
          {({ text }) => (
            <div className="flex items-center gap-2 p-2 bg-blue-100 border border-blue-300 rounded shadow-lg">
              <span className="text-xs text-blue-700">500ms delay:</span>
              <span className="text-sm font-medium text-blue-900 max-w-xs truncate">
                &ldquo;{text}&rdquo;
              </span>
            </div>
          )}
        </DemoTextArea>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">1000ms Delay</h3>
        <p className="text-sm text-gray-600 mb-4">
          Tools appear after a full second delay - useful for preventing
          accidental popup triggers during quick text selections
        </p>
        <DemoTextArea target={true} delay={1000}>
          {({ text }) => (
            <div className="flex items-center gap-2 p-2 bg-purple-100 border border-purple-300 rounded shadow-lg">
              <span className="text-xs text-purple-700">1000ms delay:</span>
              <span className="text-sm font-medium text-purple-900 max-w-xs truncate">
                &ldquo;{text}&rdquo;
              </span>
              <button
                type="button"
                className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                onClick={() => alert(`Selected after delay: "${text}"`)}
              >
                Action
              </button>
            </div>
          )}
        </DemoTextArea>
      </section>
    </div>
  ),
}
