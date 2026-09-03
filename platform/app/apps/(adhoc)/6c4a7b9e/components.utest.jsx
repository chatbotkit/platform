import { Main } from './components'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/layouts/App', () => ({
  AppNavExtra: ({ children }) => <div data-testid="nav-extra">{children}</div>,
}))

describe('Main', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn()
  })

  it('renders a single embedded chat session by default', () => {
    render(<Main />)

    expect(screen.getAllByTestId('chat-session')).toHaveLength(1)
    expect(screen.getByTitle('Chat Thread 1')).toHaveAttribute(
      'src',
      expect.stringContaining('/apps/chat?')
    )
    expect(screen.getByTitle('Chat Thread 1')).toHaveAttribute(
      'src',
      expect.stringContaining('embed=workspace')
    )
    expect(
      screen.getByRole('button', { name: 'Close thread 1' })
    ).toBeDisabled()
  })

  it('adds and closes chat sessions while keeping at least one open', () => {
    render(<Main />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Thread' }))

    expect(screen.getAllByTestId('chat-session')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Close thread 2' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Close thread 2' }))

    expect(screen.getAllByTestId('chat-session')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Close thread 1' })
    ).toBeDisabled()
  })
})
