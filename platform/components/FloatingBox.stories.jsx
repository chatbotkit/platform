import { useEffect, useState } from 'react'

import FloatingBox from './FloatingBox'

export default {
  title: 'Components/FloatingBox',
  component: FloatingBox,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A reusable component based on floating-ui that positions an element at exact x, y coordinates on the screen.',
      },
    },
  },
  argTypes: {
    x: {
      control: { type: 'number', min: 0, max: 1000, step: 1 },
      description:
        'X coordinate where the floating element should be positioned',
      defaultValue: 100,
    },
    y: {
      control: { type: 'number', min: 0, max: 1000, step: 1 },
      description:
        'Y coordinate where the floating element should be positioned',
      defaultValue: 100,
    },
    placement: {
      control: 'select',
      options: [
        undefined,
        'top',
        'top-start',
        'top-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
        'right',
        'right-start',
        'right-end',
      ],
      description: 'Preferred placement relative to the reference point',
    },
    strategy: {
      control: 'select',
      options: ['absolute', 'fixed'],
      description: 'Positioning strategy',
      defaultValue: 'absolute',
    },
    offset: {
      control: { type: 'number', min: -50, max: 50, step: 1 },
      description: 'Distance offset from the positioning point',
      defaultValue: 0,
    },
    allowedPlacements: {
      control: 'multi-select',
      options: [
        'top',
        'top-start',
        'top-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
        'right',
        'right-start',
        'right-end',
      ],
      description: 'Array of allowed placements for auto-placement',
    },
    children: {
      control: 'text',
      description: 'Content to display in the floating box',
      defaultValue: 'Floating content',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the floating element',
    },
  },
}

export const Default = {
  args: {
    x: 100,
    y: 100,
    children: (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Floating Box</h3>
        <p className="text-gray-600 mt-2">
          This box is positioned at coordinates (100, 100)
        </p>
      </div>
    ),
  },
  render: (args) => (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 text-sm text-gray-500">
        Position: ({args.x}, {args.y})
      </div>
      <FloatingBox {...args} />
    </div>
  ),
}

const InteractivePositioningComponent = () => {
  const [position, setPosition] = useState({ x: 200, y: 150 })

  const handleClick = (event) => {
    setPosition({
      x: event.clientX,
      y: event.clientY,
    })
  }

  return (
    <div
      className="relative h-screen w-full bg-gray-50 cursor-crosshair"
      onClick={handleClick}
    >
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">
          Click anywhere to reposition
        </h4>
        <p className="text-sm text-gray-600 mt-1">
          Current position: ({position.x}, {position.y})
        </p>
      </div>

      <FloatingBox
        x={position.x}
        y={position.y}
        allowedPlacements={['top', 'bottom', 'left', 'right']}
      >
        <div className="bg-blue-500 text-white p-3 rounded-lg shadow-lg">
          <div className="text-sm font-medium">📍 I&apos;m here!</div>
          <div className="text-xs opacity-90 mt-1">
            {position.x}, {position.y}
          </div>
        </div>
      </FloatingBox>
    </div>
  )
}

export const InteractivePositioning = {
  render: () => <InteractivePositioningComponent />,
  parameters: {
    docs: {
      description: {
        story:
          'Click anywhere on the screen to reposition the floating box to that exact location.',
      },
    },
  },
}

export const MultipleFloatingElements = {
  render: () => {
    const positions = [
      { x: 100, y: 100, color: 'bg-red-500', label: 'Red Box' },
      { x: 300, y: 200, color: 'bg-green-500', label: 'Green Box' },
      { x: 500, y: 150, color: 'bg-blue-500', label: 'Blue Box' },
      { x: 200, y: 300, color: 'bg-purple-500', label: 'Purple Box' },
    ]

    return (
      <div className="relative h-screen w-full bg-gray-50">
        <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
          <h4 className="font-semibold text-gray-800">
            Multiple Floating Elements
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            Each box is positioned at specific coordinates
          </p>
        </div>

        {positions.map((pos, index) => (
          <FloatingBox key={index} x={pos.x} y={pos.y}>
            <div className={`${pos.color} text-white p-3 rounded-lg shadow-lg`}>
              <div className="text-sm font-medium">{pos.label}</div>
              <div className="text-xs opacity-90 mt-1">
                ({pos.x}, {pos.y})
              </div>
            </div>
          </FloatingBox>
        ))}
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'Multiple FloatingBox components can be used simultaneously, each positioned at different coordinates.',
      },
    },
  },
}

const AnimatedMovementComponent = () => {
  const [position, setPosition] = useState({ x: 100, y: 100 })

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(() => ({
        x: 100 + Math.sin(Date.now() / 1000) * 200,
        y: 100 + Math.cos(Date.now() / 1000) * 100,
      }))
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">Animated Movement</h4>
        <p className="text-sm text-gray-600 mt-1">
          The floating box moves in a circular pattern
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Position: ({Math.round(position.x)}, {Math.round(position.y)})
        </p>
      </div>

      <FloatingBox x={position.x} y={position.y}>
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-medium">🚀 Moving Box</div>
          <div className="text-xs opacity-90 mt-1">Smooth animation</div>
        </div>
      </FloatingBox>
    </div>
  )
}

export const AnimatedMovement = {
  render: () => <AnimatedMovementComponent />,
  parameters: {
    docs: {
      description: {
        story:
          'The FloatingBox smoothly follows position changes, making it suitable for animated content.',
      },
    },
  },
}

export const TooltipStyle = {
  args: {
    x: 250,
    y: 150,
    children: (
      <div className="bg-gray-800 text-white px-3 py-2 rounded text-sm shadow-lg">
        <div className="relative">
          This is a tooltip-style floating box
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
        </div>
      </div>
    ),
  },
  render: (args) => (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">Tooltip Style</h4>
        <p className="text-sm text-gray-600 mt-1">
          FloatingBox can be styled as a tooltip or callout
        </p>
      </div>

      {/* Reference point indicator */}
      <div
        className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow"
        style={{
          left: args.x - 6,
          top: args.y - 6,
          zIndex: 10,
        }}
      />

      <FloatingBox {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'FloatingBox can be styled as a tooltip with the red dot showing the exact positioning point.',
      },
    },
  },
}

export const ResponsiveContent = {
  args: {
    x: 200,
    y: 200,
  },
  render: (args) => (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">Responsive Content</h4>
        <p className="text-sm text-gray-600 mt-1">
          FloatingBox adapts to content size
        </p>
      </div>

      <FloatingBox {...args}>
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-xs">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Responsive Card
          </h3>
          <p className="text-gray-600 text-sm mb-3">
            This floating box contains a responsive card that adapts to its
            content. The positioning remains precise regardless of content size.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            >
              Action
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </FloatingBox>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The FloatingBox component works with responsive content of any size.',
      },
    },
  },
}

export const PlacementOptions = {
  args: {
    x: 400,
    y: 300,
    placement: 'top',
    offset: 10,
  },
  render: (args) => (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">Placement Configuration</h4>
        <p className="text-sm text-gray-600 mt-1">
          Use controls to change placement and offset
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Current: {args.placement || 'auto'} with {args.offset}px offset
        </p>
      </div>

      {/* Reference point indicator */}
      <div
        className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow"
        style={{
          left: args.x - 6,
          top: args.y - 6,
          zIndex: 10,
        }}
      />

      <FloatingBox {...args}>
        <div className="bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-medium">Positioned Element</div>
          <div className="text-xs opacity-90 mt-1">
            Placement: {args.placement || 'auto'}
          </div>
        </div>
      </FloatingBox>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrate different placement options and offset configurations. The red dot shows the reference point.',
      },
    },
  },
}

export const AutoPlacement = {
  args: {
    x: 100,
    y: 100,
    allowedPlacements: ['top', 'bottom', 'left', 'right'],
    offset: 8,
  },
  render: (args) => (
    <div className="relative h-screen w-full bg-gray-50">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border">
        <h4 className="font-semibold text-gray-800">Auto Placement</h4>
        <p className="text-sm text-gray-600 mt-1">
          FloatingBox automatically chooses the best placement
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Allowed: {args.allowedPlacements?.join(', ') || 'all'}
        </p>
      </div>

      {/* Multiple reference points to test auto-placement */}
      {[
        { x: 100, y: 100, label: 'Top-left' },
        { x: 700, y: 100, label: 'Top-right' },
        { x: 100, y: 500, label: 'Bottom-left' },
        { x: 700, y: 500, label: 'Bottom-right' },
        { x: 400, y: 300, label: 'Center' },
      ].map((point, index) => (
        <div key={index}>
          <div
            className="absolute w-2 h-2 bg-red-500 rounded-full"
            style={{
              left: point.x - 4,
              top: point.y - 4,
              zIndex: 10,
            }}
          />
          <FloatingBox
            x={point.x}
            y={point.y}
            allowedPlacements={args.allowedPlacements}
            offset={args.offset}
          >
            <div className="bg-green-500 text-white px-3 py-2 rounded shadow-lg text-sm">
              {point.label}
            </div>
          </FloatingBox>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Multiple floating boxes with auto-placement that adapts based on available space and allowed placements.',
      },
    },
  },
}

export const StrategyComparison = {
  render: () => (
    <div className="relative h-screen w-full bg-gray-50 overflow-auto">
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow border z-20">
        <h4 className="font-semibold text-gray-800">Strategy Comparison</h4>
        <p className="text-sm text-gray-600 mt-1">
          Absolute vs Fixed positioning strategies
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Scroll to see the difference
        </p>
      </div>

      {/* Create a scrollable area */}
      <div className="h-[200vh] pt-20">
        {/* Absolute positioning - scrolls with content */}
        <FloatingBox x={200} y={200} strategy="absolute">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="text-sm font-medium">Absolute Strategy</div>
            <div className="text-xs opacity-90 mt-1">Scrolls with content</div>
          </div>
        </FloatingBox>

        {/* Fixed positioning - stays in viewport */}
        <FloatingBox x={200} y={300} strategy="fixed">
          <div className="bg-purple-500 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="text-sm font-medium">Fixed Strategy</div>
            <div className="text-xs opacity-90 mt-1">Stays in viewport</div>
          </div>
        </FloatingBox>

        <div className="mt-[100vh] p-8 bg-white rounded-lg shadow mx-8">
          <h3 className="text-lg font-semibold mb-4">Scroll Area Content</h3>
          <p className="text-gray-600">
            This content demonstrates the difference between absolute and fixed
            positioning strategies. The blue box (absolute) will scroll with
            this content, while the purple box (fixed) remains in a fixed
            position relative to the viewport.
          </p>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Compare absolute vs fixed positioning strategies. Scroll to see how each strategy behaves.',
      },
    },
  },
}
