import {
  Default,
  FastIncrement,
  Interactive,
  NegativeTarget,
  ZeroTarget,
} from './useIncrementIndexAfterDelay.stories'

import { fireEvent, render, screen } from '@testing-library/react'

const mockUseIncrementIndexAfterDelay = jest.fn()

jest.mock('./useIncrementIndexAfterDelay', () => ({
  __esModule: true,
  default: (...args) => mockUseIncrementIndexAfterDelay(...args),
}))

describe('useIncrementIndexAfterDelay stories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders default story values and current index', () => {
    mockUseIncrementIndexAfterDelay.mockReturnValue(2)

    render(<Default.render {...Default.args} />)

    expect(screen.getByText('Target (to):')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('Delay:')).toBeDefined()
    expect(screen.getByText('1000ms')).toBeDefined()
    expect(screen.getByText('Current Index:')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('passes fast increment args to the hook', () => {
    mockUseIncrementIndexAfterDelay.mockReturnValue(4)

    render(<FastIncrement.render {...FastIncrement.args} />)

    expect(mockUseIncrementIndexAfterDelay).toHaveBeenCalledWith(10, 200)
  })

  it('handles zero and negative target variants', () => {
    mockUseIncrementIndexAfterDelay.mockReturnValue(0)
    render(<ZeroTarget.render {...ZeroTarget.args} />)
    expect(screen.getByText('0%')).toBeDefined()

    mockUseIncrementIndexAfterDelay.mockReturnValue(-1)
    render(<NegativeTarget.render {...NegativeTarget.args} />)
    expect(mockUseIncrementIndexAfterDelay).toHaveBeenCalledWith(-1, 1000)
  })

  it('updates interactive controls and calls hook with new values', () => {
    mockUseIncrementIndexAfterDelay.mockReturnValue(1)

    render(<Interactive.render />)

    const inputs = screen.getAllByRole('spinbutton')

    fireEvent.change(inputs[0], { target: { value: '8' } })
    fireEvent.change(inputs[1], { target: { value: '300' } })

    expect(mockUseIncrementIndexAfterDelay).toHaveBeenLastCalledWith(8, 300)
  })
})
