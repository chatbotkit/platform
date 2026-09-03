import ThisSolution from './ThisSolution'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Component', () => {
  return function MockComponent({ children }) {
    return <>{children}</>
  }
})

jest.mock('@/components/Confirm', () => ({
  useConfirm: () => jest.fn().mockResolvedValue(false),
}))

jest.mock('@/components/CopyButton', () => {
  return function MockCopyButton({ children }) {
    return <div>{children}</div>
  }
})

jest.mock('@/components/FOC', () => {
  return function MockFOC({ items, children }) {
    return (
      <div>
        <div data-testid="foc-items">{JSON.stringify(items)}</div>
        {children}
      </div>
    )
  }
})

jest.mock('@/components/Portal', () => {
  return function MockPortal({ children }) {
    return <>{children}</>
  }
})

jest.mock('@/hooks/useDashboardWidgetSend', () => {
  return () => ({ send: jest.fn() })
})

jest.mock('@/hooks/useTeamSwitch', () => {
  return () => ({ isSwitched: false })
})

jest.mock('@/hooks/useUserSwitch', () => {
  return () => ({ isSwitched: false })
})

function getItems() {
  return JSON.parse(screen.getByTestId('foc-items').textContent)
}

describe('ThisSolution', () => {
  it('shows an add to blueprint action when the resource is not part of a blueprint', () => {
    render(<ThisSolution type="bot" instance={{ id: 'bot_123' }} />)

    expect(
      getItems().some(
        (item) =>
          item.title === 'Add to Blueprint' && item.link === '/blueprints'
      )
    ).toBe(true)
  })

  it('does not show an add to blueprint action when the resource already belongs to a blueprint', () => {
    render(
      <ThisSolution
        type="bot"
        instance={{ id: 'bot_123', blueprintId: 'blueprint_123' }}
      />
    )

    expect(getItems().some((item) => item.title === 'Add to Blueprint')).toBe(
      false
    )
  })

  it('renders only one instance when multiple are mounted on the same page', () => {
    render(
      <>
        <ThisSolution type="bot" instance={{ id: 'bot_123' }} />
        <ThisSolution type="bot" instance={{ id: 'bot_123' }} />
      </>
    )

    expect(screen.getAllByTestId('foc-items')).toHaveLength(1)
  })
})
