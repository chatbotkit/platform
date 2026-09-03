import ThemeCanvas from './ThemeCanvas'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const hideMock = jest.fn()
const showMock = jest.fn()
const setCenterMock = jest.fn()
const getNodeMock = jest.fn(() => ({
  position: { x: 10, y: 20 },
  width: 100,
  height: 200,
}))

jest.mock('@chatbotkit/react/hooks/useWidgetInstance', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    hide: hideMock,
    show: showMock,
  })),
}))

jest.mock('@/hooks/useTheme', () => ({
  __esModule: true,
  default: jest.fn(() => ({ theme: 'dark' })),
}))

jest.mock('@/components/Portal', () => {
  return function Portal({ children }) {
    return <div data-testid="portal">{children}</div>
  }
})

jest.mock('@xyflow/react', () => ({
  __esModule: true,
  Background: () => <div data-testid="flow-background" />,
  ControlButton: ({ children, ...props }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Controls: ({ children }) => <div data-testid="flow-controls">{children}</div>,
  ReactFlowProvider: ({ children }) => (
    <div data-testid="flow-provider">{children}</div>
  ),
  ReactFlow: ({ children }) => <div data-testid="react-flow">{children}</div>,
  useReactFlow: () => ({
    getNode: getNodeMock,
    setCenter: setCenterMock,
  }),
}))

describe('ThemeCanvas', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('renders with portal and fullscreen toggle control', async () => {
    render(
      <ThemeCanvas defaultFullscreen={false}>
        <div>Child preview</div>
      </ThemeCanvas>
    )

    expect(screen.getByTestId('portal')).toHaveTextContent('Child preview')
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(hideMock).toHaveBeenCalledTimes(1)
    })
  })

  it('calls setCenter after mounting to center widget node', () => {
    render(<ThemeCanvas defaultFullscreen={false} />)

    jest.runOnlyPendingTimers()

    expect(getNodeMock).toHaveBeenCalledWith('widget')
    expect(setCenterMock).toHaveBeenCalledWith(60, 120, { zoom: 0.8 })
  })

  it('hides widget when default fullscreen is enabled', () => {
    render(<ThemeCanvas defaultFullscreen={true} />)

    expect(hideMock).toHaveBeenCalled()
    expect(showMock).not.toHaveBeenCalled()
  })
})
