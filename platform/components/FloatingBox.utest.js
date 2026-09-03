/* eslint-disable @typescript-eslint/no-require-imports */
import FloatingBox, { scaleTransitionStyles } from './FloatingBox'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

const mockUseTransitionStyles = jest.fn()
const mockTransitionStylesFn = jest.fn(() => ({ custom: { opacity: 0.5 } }))

jest.mock('@/components/Children', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}))

jest.mock('@/components/Component', () => ({
  __esModule: true,
  default: require('react').forwardRef(function MockComponent(
    { as: As = 'div', children, ...props },
    ref
  ) {
    return (
      <As ref={ref} {...props}>
        {children}
      </As>
    )
  }),
}))

jest.mock('@/hooks/usePrevious', () => ({
  __esModule: true,
  default: (_value, fallback) => fallback,
}))

jest.mock('@floating-ui/react', () => ({
  autoPlacement: jest.fn((options) => ({ type: 'autoPlacement', options })),
  offset: jest.fn((value) => ({ type: 'offset', value })),
  useFloating: jest.fn(() => ({
    refs: {
      setReference: jest.fn(),
      setFloating: jest.fn(),
    },
    floatingStyles: { top: 10, left: 20 },
    context: { id: 'ctx' },
  })),
  useClientPoint: jest.fn(() => ({ id: 'client-point' })),
  useInteractions: jest.fn(() => ({
    getReferenceProps: jest.fn(() => ({ 'data-reference': '1' })),
    getFloatingProps: jest.fn(() => ({ 'data-floating': '1' })),
  })),
  useTransitionStyles: (...args) => mockUseTransitionStyles(...args),
}))

describe('FloatingBox', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTransitionStyles.mockReturnValue({
      isMounted: true,
      styles: { opacity: 1 },
    })
  })

  it('renders children and applies classes when mounted', () => {
    render(
      <FloatingBox className="root-class" floatingClassName="floating-class">
        <span>content</span>
      </FloatingBox>
    )

    expect(screen.getByText('content')).toBeInTheDocument()

    const floatingContent = screen
      .getByText('content')
      .closest('.floating-content')

    expect(floatingContent).toHaveClass('floating-content')
    expect(floatingContent).toHaveClass('floating-class')
    expect(floatingContent).toHaveStyle({ opacity: '1' })
  })

  it('does not render when transition is not mounted', () => {
    mockUseTransitionStyles.mockReturnValue({
      isMounted: false,
      styles: {},
    })

    render(<FloatingBox>hidden</FloatingBox>)

    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('uses predefined scale transition styles when transitionStyles is scale', () => {
    render(<FloatingBox transitionStyles="scale">content</FloatingBox>)

    expect(mockUseTransitionStyles).toHaveBeenCalledWith(
      expect.anything(),
      scaleTransitionStyles
    )
  })

  it('uses transition style function result when provided', () => {
    render(
      <FloatingBox transitionStyles={mockTransitionStylesFn}>
        content
      </FloatingBox>
    )

    expect(mockTransitionStylesFn).toHaveBeenCalledTimes(1)
    expect(mockUseTransitionStyles).toHaveBeenCalledWith(expect.anything(), {
      custom: { opacity: 0.5 },
    })
  })
})
