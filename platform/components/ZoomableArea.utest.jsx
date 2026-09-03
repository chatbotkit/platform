import ZoomableArea from './ZoomableArea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Component', () => ({
  __esModule: true,
  default: ({ as: As = 'div', children, ...props }) => (
    <As {...props}>{children}</As>
  ),
}))

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => <>{children}</>,
}))

jest.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: (props) => <svg data-testid="x-icon" {...props} />,
}))

describe('ZoomableArea', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders children in default non-zoomed mode', () => {
    render(<ZoomableArea>content</ZoomableArea>)

    expect(screen.getByText('content')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the non-zoomed wrapper full-width by default', () => {
    const { container } = render(<ZoomableArea>content</ZoomableArea>)

    expect(container.firstChild).toHaveClass('zoomable-area')
    expect(container.firstChild).toHaveClass('w-full')
  })

  it('shows fullscreen wrapper and disables body scroll when zoomed', () => {
    render(<ZoomableArea defaultZoomed={true}>content</ZoomableArea>)

    expect(screen.getByRole('button')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('calls setZoomed(false) when escape is pressed in controlled mode', () => {
    const setZoomed = jest.fn()

    render(
      <ZoomableArea zoomed={true} setZoomed={setZoomed}>
        content
      </ZoomableArea>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(setZoomed).toHaveBeenCalledWith(false)
  })

  it('calls setZoomed(false) when close button is clicked in controlled mode', () => {
    const setZoomed = jest.fn()

    render(
      <ZoomableArea zoomed={true} setZoomed={setZoomed}>
        content
      </ZoomableArea>
    )

    fireEvent.click(screen.getByRole('button'))

    expect(setZoomed).toHaveBeenCalledWith(false)
  })
})
