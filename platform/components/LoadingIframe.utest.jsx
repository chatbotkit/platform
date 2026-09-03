import LoadingIframe from './LoadingIframe'

import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock(
  '@/components/DotsLoader',
  () =>
    function MockDotsLoader(props) {
      return <div data-testid="dots-loader" {...props} />
    }
)

describe('LoadingIframe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders iframe immediately when no postMessageEvent is provided', () => {
    const { container } = render(
      <LoadingIframe title="embedded" src="about:blank" />
    )

    const iframe = container.querySelector('iframe')

    expect(iframe).toHaveAttribute('title', 'embedded')
    expect(iframe).toHaveClass('opacity-100')
    expect(iframe).not.toHaveClass('opacity-0')
    expect(screen.getByTestId('dots-loader')).toBeInTheDocument()
  })

  it('waits for matching postMessage event before showing iframe', async () => {
    const { container } = render(
      <LoadingIframe
        postMessageEvent="iframe-ready"
        title="embedded"
        src="about:blank"
      />
    )

    const iframe = container.querySelector('iframe')
    const sourceWindow = {}

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: sourceWindow,
    })

    await waitFor(() => {
      expect(iframe).toHaveClass('opacity-0')
    })

    window.dispatchEvent(
      new MessageEvent('message', { data: 'iframe-ready', source: {} })
    )

    expect(iframe).toHaveClass('opacity-0')

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'iframe-ready',
        source: sourceWindow,
      })
    )

    await waitFor(() => {
      expect(iframe).not.toHaveClass('opacity-0')
    })
  })
})
