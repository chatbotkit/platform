import FadeInIframe from './FadeInIframe'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

describe('FadeInIframe', () => {
  it('should render the iframe transparent before it loads', () => {
    const { container } = render(<FadeInIframe src="https://example.com" />)

    const iframe = container.querySelector('iframe')

    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveClass('opacity-0')
    expect(iframe).toHaveClass('transition-opacity')
    expect(iframe).not.toHaveClass('opacity-100')
  })

  it('should fade the iframe in once it loads', () => {
    const { container } = render(<FadeInIframe src="https://example.com" />)

    const iframe = container.querySelector('iframe')

    fireEvent.load(iframe)

    expect(iframe).toHaveClass('opacity-100')
    expect(iframe).not.toHaveClass('opacity-0')
  })

  it('should preserve the provided className', () => {
    const { container } = render(
      <FadeInIframe src="https://example.com" className="w-full h-full" />
    )

    const iframe = container.querySelector('iframe')

    expect(iframe).toHaveClass('w-full')
    expect(iframe).toHaveClass('h-full')
  })

  it('should pass additional props to the iframe', () => {
    const { container } = render(
      <FadeInIframe
        src="https://example.com"
        title="Test Frame"
        loading="lazy"
      />
    )

    const iframe = container.querySelector('iframe')

    expect(iframe).toHaveAttribute('src', 'https://example.com')
    expect(iframe).toHaveAttribute('title', 'Test Frame')
    expect(iframe).toHaveAttribute('loading', 'lazy')
  })

  it('should call the provided onLoad handler', () => {
    const onLoad = jest.fn()

    const { container } = render(
      <FadeInIframe src="https://example.com" onLoad={onLoad} />
    )

    const iframe = container.querySelector('iframe')

    fireEvent.load(iframe)

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'load' })
    )
  })

  it('should not throw if onLoad is not provided', () => {
    const { container } = render(<FadeInIframe src="https://example.com" />)

    const iframe = container.querySelector('iframe')

    expect(() => {
      fireEvent.load(iframe)
    }).not.toThrow()
  })
})
