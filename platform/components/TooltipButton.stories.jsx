import GlobalRoot from './GlobalRoot'
import TooltipButton from './TooltipButton'

export default {
  title: 'Components/TooltipButton',
  component: TooltipButton,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <GlobalRoot />
      </>
    ),
  ],
  argTypes: {
    as: {
      control: 'select',
      options: ['button', 'div', 'span', 'a'],
      description: 'HTML element or component to render as',
      defaultValue: 'button',
    },
    caption: {
      control: 'text',
      description: 'Content for the button (when using tooltip prop)',
    },
    tooltip: {
      control: 'text',
      description: 'Content for the tooltip (when using caption prop)',
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'Preferred placement of the tooltip',
    },
    strategy: {
      control: 'select',
      options: ['absolute', 'fixed'],
      description: 'Positioning strategy',
      defaultValue: 'absolute',
    },
    delay: {
      control: 'number',
      description: 'Delay before showing tooltip (ms)',
    },
    restMs: {
      control: 'number',
      description: 'Rest time before hiding tooltip (ms)',
    },
    offset: {
      control: 'number',
      description: 'Distance between button and tooltip',
      defaultValue: 10,
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the tooltip is disabled',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the button',
    },
    tooltipClassName: {
      control: 'text',
      description: 'CSS classes for the tooltip',
    },
  },
}

export const Default = {
  args: {
    caption: 'Hover me',
    children: <p>This is tooltip content!</p>,
  },
}

export const BasicTooltip = {
  args: {
    tooltip: <p>This is tooltip content!</p>,
    children: 'Click Me',
  },
}

export const WithStyledTooltip = {
  args: {
    caption: 'Styled Button',
    className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
    tooltipClassName: 'bg-black text-white p-2 rounded shadow-lg text-sm',
    children: (
      <div>
        <h4 className="font-bold">Rich Tooltip</h4>
        <p className="text-sm">This tooltip has multiple elements</p>
        <ul className="text-xs mt-1">
          <li>• Feature 1</li>
          <li>• Feature 2</li>
          <li>• Feature 3</li>
        </ul>
      </div>
    ),
  },
}

export const DifferentPlacements = {
  render: () => (
    <div className="grid grid-cols-3 gap-8 place-items-center min-h-[400px]">
      <div></div>
      <TooltipButton
        caption="Top"
        placement="top"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <p>Tooltip on top</p>
      </TooltipButton>
      <div></div>

      <TooltipButton
        caption="Left"
        placement="left"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <p>Tooltip on left</p>
      </TooltipButton>

      <div className="text-center text-gray-600">
        Hover over the buttons to see different placements
      </div>

      <TooltipButton
        caption="Right"
        placement="right"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <p>Tooltip on right</p>
      </TooltipButton>

      <div></div>
      <TooltipButton
        caption="Bottom"
        placement="bottom"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <p>Tooltip on bottom</p>
      </TooltipButton>
      <div></div>
    </div>
  ),
}

export const WithDelay = {
  args: {
    caption: 'Hover me (500ms delay)',
    delay: 500,
    className: 'px-4 py-2 bg-green-500 text-white rounded',
    children: <p>This tooltip appears after 500ms delay</p>,
  },
}

export const WithCustomOffset = {
  args: {
    caption: 'Large offset',
    offset: 30,
    className: 'px-4 py-2 bg-purple-500 text-white rounded',
    children: <p>This tooltip is positioned 30px away</p>,
  },
}

export const DisabledTooltip = {
  args: {
    caption: 'Disabled tooltip',
    disabled: true,
    className: 'px-4 py-2 bg-gray-400 text-gray-600 rounded cursor-not-allowed',
    children: <p>This tooltip will not appear because it is disabled</p>,
  },
}

export const FunctionChildren = {
  render: () => (
    <TooltipButton
      caption="Interactive tooltip"
      className="px-4 py-2 bg-indigo-500 text-white rounded"
    >
      {({ close }) => (
        <div className="bg-white border rounded shadow-lg p-3">
          <p className="mb-2">This is an interactive tooltip!</p>
          <button
            type="button"
            onClick={close}
            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
          >
            Close
          </button>
        </div>
      )}
    </TooltipButton>
  ),
}

export const AsLink = {
  render: () => (
    <TooltipButton
      as="a"
      href="#"
      caption="I'm a link with tooltip"
      className="text-blue-500 underline"
      onClick={(e) => e.preventDefault()}
    >
      <p>This tooltip is on a link element</p>
    </TooltipButton>
  ),
}

export const MultipleButtons = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <TooltipButton
        caption="Success"
        className="px-3 py-2 bg-green-500 text-white rounded"
      >
        <p>✅ Operation successful</p>
      </TooltipButton>

      <TooltipButton
        caption="Warning"
        className="px-3 py-2 bg-yellow-500 text-white rounded"
        placement="top"
      >
        <p>⚠️ Warning message</p>
      </TooltipButton>

      <TooltipButton
        caption="Error"
        className="px-3 py-2 bg-red-500 text-white rounded"
        placement="right"
      >
        <p>❌ Error occurred</p>
      </TooltipButton>

      <TooltipButton
        caption="Info"
        className="px-3 py-2 bg-blue-500 text-white rounded"
        placement="left"
      >
        <p>ℹ️ Information tooltip</p>
      </TooltipButton>
    </div>
  ),
}

export const LongContent = {
  args: {
    caption: 'Long content',
    className: 'px-4 py-2 bg-gray-600 text-white rounded',
    tooltipClassName: 'max-w-xs bg-black text-white p-3 rounded shadow-lg',
    children: (
      <div>
        <h3 className="font-bold mb-2">Detailed Information</h3>
        <p className="mb-2">
          This is a longer tooltip with multiple paragraphs and detailed
          information that demonstrates how the component handles larger
          content.
        </p>
        <p className="mb-2">
          The tooltip will automatically position itself to stay within the
          viewport and adjust its placement as needed.
        </p>
        <div className="text-xs text-gray-300">
          Pro tip: You can include any React content in tooltips!
        </div>
      </div>
    ),
  },
}

export const AllowedPlacements = {
  args: {
    caption: 'Restricted placement',
    allowedPlacements: ['top', 'bottom'],
    className: 'px-4 py-2 bg-orange-500 text-white rounded',
    children: <p>This tooltip can only appear on top or bottom</p>,
  },
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <div className="flex gap-4">
          <TooltipButton caption="Simple">
            <p>Basic tooltip</p>
          </TooltipButton>
          <TooltipButton tooltip={<p>Alternative syntax</p>}>
            Alternative
          </TooltipButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Styled Examples</h3>
        <div className="flex gap-4">
          <TooltipButton
            caption="Primary"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            tooltipClassName="bg-blue-900 text-white p-2 rounded"
          >
            <p>Primary action tooltip</p>
          </TooltipButton>
          <TooltipButton
            caption="Secondary"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            tooltipClassName="bg-gray-800 text-white p-2 rounded"
          >
            <p>Secondary action tooltip</p>
          </TooltipButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Interactive Content</h3>
        <TooltipButton
          caption="Interactive"
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          {({ close }) => (
            <div className="bg-white border rounded shadow-lg p-4 max-w-sm">
              <h4 className="font-bold mb-2">Interactive Tooltip</h4>
              <p className="text-sm text-gray-600 mb-3">
                This tooltip contains interactive elements and can be closed
                programmatically.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  onClick={() => alert('Action performed!')}
                >
                  Action
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </TooltipButton>
      </section>
    </div>
  ),
}
