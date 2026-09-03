import GlobalRoot from './GlobalRoot'
import PopButton from './PopButton'

export default {
  title: 'Components/PopButton',
  component: PopButton,
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
      description: 'Content for the button (when using pop prop)',
    },
    pop: {
      control: 'text',
      description: 'Content for the popup (when using caption prop)',
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'Preferred placement of the popup',
    },
    strategy: {
      control: 'select',
      options: ['absolute', 'fixed'],
      description: 'Positioning strategy',
      defaultValue: 'absolute',
    },
    offset: {
      control: 'number',
      description: 'Distance between button and popup',
      defaultValue: 10,
    },
    closeOnClick: {
      control: 'boolean',
      description: 'Whether clicking the popup content closes it',
    },
    escapeKey: {
      control: 'boolean',
      description: 'Whether pressing escape closes the popup',
      defaultValue: true,
    },
    outsidePress: {
      control: 'boolean',
      description: 'Whether clicking outside closes the popup',
      defaultValue: true,
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the popup is disabled',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the button',
    },
    popClassName: {
      control: 'text',
      description: 'CSS classes for the popup',
    },
  },
}

export const Default = {
  args: {
    caption: 'Click Me',
    children: (
      <div className="bg-red-500 w-96 p-4">
        <p className="text-white">This is a pop-up content!</p>
      </div>
    ),
  },
}

export const BasicPopup = {
  args: {
    pop: (
      <div className="bg-blue-500 w-64 p-4 rounded shadow-lg">
        <p className="text-white">Basic popup content</p>
      </div>
    ),
    children: 'Open Popup',
  },
}

export const StyledButton = {
  args: {
    caption: 'Styled Button',
    className: 'px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600',
    popClassName: 'bg-white border rounded shadow-xl z-50',
    children: (
      <div className="p-6 max-w-sm">
        <h3 className="text-lg font-bold mb-2">Welcome!</h3>
        <p className="text-gray-600 mb-4">
          This is a styled popup with custom classes applied to both the button
          and popup container.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Action
          </button>
          <button
            type="button"
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    ),
  },
}

export const DifferentPlacements = {
  render: () => (
    <div className="grid grid-cols-3 gap-8 place-items-center min-h-[400px]">
      <div></div>
      <PopButton
        caption="Top"
        placement="top"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <div className="bg-black text-white p-3 rounded">
          <p>Popup on top</p>
        </div>
      </PopButton>
      <div></div>

      <PopButton
        caption="Left"
        placement="left"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <div className="bg-black text-white p-3 rounded">
          <p>Popup on left</p>
        </div>
      </PopButton>

      <div className="text-center text-gray-600">
        Click the buttons to see different placements
      </div>

      <PopButton
        caption="Right"
        placement="right"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <div className="bg-black text-white p-3 rounded">
          <p>Popup on right</p>
        </div>
      </PopButton>

      <div></div>
      <PopButton
        caption="Bottom"
        placement="bottom"
        className="px-3 py-2 bg-gray-200 rounded"
      >
        <div className="bg-black text-white p-3 rounded">
          <p>Popup on bottom</p>
        </div>
      </PopButton>
      <div></div>
    </div>
  ),
}

export const WithCloseOnClick = {
  args: {
    caption: 'Click content to close',
    closeOnClick: true,
    className: 'px-4 py-2 bg-green-500 text-white rounded',
    children: (
      <div className="bg-green-100 border border-green-300 rounded p-4 max-w-sm">
        <p className="text-green-800 mb-2">
          Click anywhere in this popup to close it!
        </p>
        <p className="text-green-600 text-sm">
          This demonstrates the closeOnClick feature.
        </p>
      </div>
    ),
  },
}

export const DisabledEscapeAndOutside = {
  args: {
    caption: 'Only manual close',
    escapeKey: false,
    outsidePress: false,
    className: 'px-4 py-2 bg-orange-500 text-white rounded',
    children: (
      <div className="bg-orange-100 border border-orange-300 rounded p-4 max-w-sm">
        <p className="text-orange-800 mb-3">
          This popup can only be closed by clicking the close button below.
          Escape key and outside clicks are disabled.
        </p>
      </div>
    ),
  },
}

export const InteractiveContent = {
  render: () => (
    <PopButton
      caption="Interactive Popup"
      className="px-4 py-2 bg-indigo-500 text-white rounded"
    >
      {({ close }) => (
        <div className="bg-white border rounded shadow-xl p-6 max-w-md">
          <h3 className="text-lg font-bold mb-4">Interactive Popup</h3>
          <p className="text-gray-600 mb-4">
            This popup contains interactive elements and demonstrates function
            children pattern.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter some text..."
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                onClick={() => {
                  alert('Action performed!')
                  close()
                }}
              >
                Submit
              </button>
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PopButton>
  ),
}

export const AsDropdownMenu = {
  render: () => (
    <PopButton
      caption="Menu ▼"
      placement="bottom-start"
      className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
      popClassName="bg-white border rounded shadow-lg z-50"
    >
      <div className="py-1 min-w-48">
        <button
          type="button"
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
        >
          Edit Profile
        </button>
        <button
          type="button"
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
        >
          Settings
        </button>
        <hr className="my-1" />
        <button
          type="button"
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
        >
          Sign Out
        </button>
      </div>
    </PopButton>
  ),
}

export const CustomOffset = {
  args: {
    caption: 'Large offset',
    offset: 30,
    className: 'px-4 py-2 bg-teal-500 text-white rounded',
    children: (
      <div className="bg-teal-100 border border-teal-300 rounded p-4">
        <p className="text-teal-800">
          This popup is positioned 30px away from the button
        </p>
      </div>
    ),
  },
}

export const DisabledPopup = {
  args: {
    caption: 'Disabled button',
    disabled: true,
    className: 'px-4 py-2 bg-gray-400 text-gray-600 rounded cursor-not-allowed',
    children: (
      <div className="bg-gray-100 p-4">
        <p>This popup will not appear because the button is disabled</p>
      </div>
    ),
  },
}

export const AllowedPlacements = {
  args: {
    caption: 'Restricted placement',
    allowedPlacements: ['top', 'bottom'],
    className: 'px-4 py-2 bg-pink-500 text-white rounded',
    children: (
      <div className="bg-pink-100 border border-pink-300 rounded p-4">
        <p className="text-pink-800">
          This popup can only appear on top or bottom
        </p>
      </div>
    ),
  },
}

export const LargeContent = {
  render: () => (
    <PopButton
      caption="Large Content"
      className="px-4 py-2 bg-gray-600 text-white rounded"
      popClassName="bg-white border rounded shadow-xl z-50 max-w-2xl"
    >
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Large Popup Content</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="text-sm space-y-1">
              <li>• Auto-positioning</li>
              <li>• Click to toggle</li>
              <li>• Escape to close</li>
              <li>• Outside click to close</li>
              <li>• Customizable styling</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Use Cases</h3>
            <ul className="text-sm space-y-1">
              <li>• Dropdown menus</li>
              <li>• Modal dialogs</li>
              <li>• Context menus</li>
              <li>• Form overlays</li>
              <li>• Information panels</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          This demonstrates how PopButton handles larger content with automatic
          positioning and responsive behavior within the viewport.
        </p>
      </div>
    </PopButton>
  ),
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <div className="flex gap-4">
          <PopButton caption="Simple Popup">
            <div className="bg-gray-100 p-4 rounded">
              <p>Basic popup content</p>
            </div>
          </PopButton>
          <PopButton
            pop={
              <div className="bg-blue-100 p-4 rounded">
                <p>Alternative syntax</p>
              </div>
            }
          >
            Alternative
          </PopButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Styled Examples</h3>
        <div className="flex gap-4">
          <PopButton
            caption="Success"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-green-800">✅ Success message popup</p>
            </div>
          </PopButton>
          <PopButton
            caption="Warning"
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800">⚠️ Warning message popup</p>
            </div>
          </PopButton>
          <PopButton
            caption="Error"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-800">❌ Error message popup</p>
            </div>
          </PopButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Interactive Examples</h3>
        <div className="flex gap-4">
          <PopButton
            caption="Form Popup"
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            {({ close }) => (
              <div className="bg-white border rounded shadow-lg p-6 max-w-sm">
                <h4 className="font-bold mb-3">Quick Form</h4>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    placeholder="Message"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 bg-blue-500 text-white rounded text-sm"
                      onClick={() => {
                        alert('Form submitted!')
                        close()
                      }}
                    >
                      Submit
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </PopButton>

          <PopButton
            caption="Menu"
            className="px-4 py-2 bg-purple-500 text-white rounded"
            popClassName="bg-white border rounded shadow-lg"
          >
            <div className="py-1 min-w-40">
              {['Option 1', 'Option 2', 'Option 3'].map((option, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  onClick={() => alert(`Selected: ${option}`)}
                >
                  {option}
                </button>
              ))}
            </div>
          </PopButton>
        </div>
      </section>
    </div>
  ),
}
