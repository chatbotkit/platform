import { useEffect, useRef } from 'react'

import useIsScrolled from './useIsContainerScrolled'

const meta = {
  title: 'Hooks/useIsContainerScrolled',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Interactive demo for the useIsContainerScrolled hook. Shows top/bottom anchor detection in a scrollable container.',
      },
    },
  },
}

export default meta

const ScrollDemo = ({
  anchor = 'top',
  threshold = 0,
  height = 160,
  itemCount = 30,
  interval = 0,
  delay = 0,
}) => {
  const ref = useRef(null)
  const isScrolled = useIsScrolled(ref, {
    anchor,
    threshold,
    interval,
    delay,
    defaultValue: anchor === 'top' ? true : false,
  })

  // Force initial render after mount
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = anchor === 'top' ? 0 : ref.current.scrollHeight
    }
  }, [anchor])

  const statusText =
    anchor === 'top'
      ? isScrolled
        ? '✓ At top'
        : '✗ Scrolled away from top'
      : isScrolled
        ? '✓ At bottom'
        : '✗ Scrolled away from bottom'

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
      <div>
        <strong>anchor:</strong> {anchor} · <strong>threshold:</strong>{' '}
        {threshold}px · <strong>status:</strong>{' '}
        <span
          aria-live="polite"
          style={{
            fontFamily: 'monospace',
            color: isScrolled ? '#16a34a' : '#dc2626',
            fontWeight: 600,
          }}
        >
          {statusText}
        </span>
      </div>

      <div
        ref={ref}
        style={{
          height,
          overflow: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: 0,
          background: '#fff',
        }}
      >
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #f3f4f6',
              background: i % 2 ? '#fbfdff' : 'transparent',
            }}
          >
            Item {i + 1}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <small style={{ color: '#6b7280' }}>
          Scroll the container to see the hook update. Try both top and bottom
          anchors.
        </small>
      </div>
    </div>
  )
}

export const Default = {
  render: (args) => <ScrollDemo {...args} />,
  args: {
    anchor: 'top',
    threshold: 2,
    height: 160,
    itemCount: 30,
    interval: 0,
    delay: 0,
  },
}

export const BottomAnchor = {
  render: (args) => <ScrollDemo {...args} />,
  args: {
    anchor: 'bottom',
    threshold: 2,
    height: 160,
    itemCount: 30,
    interval: 0,
    delay: 0,
  },
}
