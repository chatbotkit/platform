import { act } from 'react'

import LoadMoreButton from './LoadMoreButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('LoadMoreButton', () => {
  function setup({ hasMore = true, autoLoad = false } = {}) {
    const loadMore = jest.fn().mockResolvedValue(undefined)
    const onClick = jest.fn()

    render(
      <LoadMoreButton
        hasMore={hasMore}
        loadMore={loadMore}
        autoLoad={autoLoad}
        onClick={onClick}
      >
        Test Load
      </LoadMoreButton>
    )

    return { loadMore, onClick }
  }

  it('renders nothing when hasMore is false', () => {
    const { container } = render(
      <LoadMoreButton hasMore={false} loadMore={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders button when hasMore is true', () => {
    setup()

    const button = screen.getByRole('button')

    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Test Load')
  })

  it('calls loadMore on click', async () => {
    const { loadMore, onClick } = setup()
    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(button)
    })

    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('prevents concurrent loadMore calls', async () => {
    const loadMore = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50))
      )

    render(
      <LoadMoreButton hasMore loadMore={loadMore}>
        Load
      </LoadMoreButton>
    )

    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('disables button while loading', async () => {
    const loadMore = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 20))
      )

    render(
      <LoadMoreButton hasMore loadMore={loadMore}>
        Load
      </LoadMoreButton>
    )

    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(button)
    })

    // allow state update flush
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('auto loads when visible on mount with autoLoad', async () => {
    // mock window.scrollY and innerHeight to ensure visibility
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
    Object.defineProperty(window, 'innerHeight', {
      value: 10000,
      writable: true,
    })

    const loadMore = jest.fn().mockResolvedValue(undefined)

    await act(async () => {
      render(
        <div>
          <LoadMoreButton hasMore autoLoad loadMore={loadMore}>
            Load
          </LoadMoreButton>
        </div>
      )
    })

    // allow promises to flush
    await act(async () => {})

    expect(loadMore).toHaveBeenCalledTimes(1)
  })
})
