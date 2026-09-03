import { BottomAnchor, Default } from './useIsContainerScrolled.stories'

import { render, screen } from '@testing-library/react'

const mockUseIsScrolled = jest.fn()

jest.mock('./useIsContainerScrolled', () => ({
  __esModule: true,
  default: (...args) => mockUseIsScrolled(...args),
}))

describe('useIsContainerScrolled stories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders default story with top anchor and positive status', () => {
    mockUseIsScrolled.mockReturnValue(true)

    render(<Default.render {...Default.args} />)

    expect(mockUseIsScrolled).toHaveBeenCalledWith(expect.any(Object), {
      anchor: 'top',
      threshold: 2,
      interval: 0,
      delay: 0,
      defaultValue: true,
    })
    expect(screen.getByText('✓ At top')).toBeDefined()
  })

  it('renders default story with scrolled-away status', () => {
    mockUseIsScrolled.mockReturnValue(false)

    render(<Default.render {...Default.args} />)

    expect(screen.getByText('✗ Scrolled away from top')).toBeDefined()
  })

  it('renders bottom anchor story status text', () => {
    mockUseIsScrolled.mockReturnValue(true)

    render(<BottomAnchor.render {...BottomAnchor.args} />)

    expect(mockUseIsScrolled).toHaveBeenCalledWith(expect.any(Object), {
      anchor: 'bottom',
      threshold: 2,
      interval: 0,
      delay: 0,
      defaultValue: false,
    })
    expect(screen.getByText('✓ At bottom')).toBeDefined()
  })
})
