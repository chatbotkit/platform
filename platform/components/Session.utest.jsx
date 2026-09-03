import Session from './Session'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children, basePath }) => (
    <div data-testid="session-provider" data-base-path={basePath}>
      {children}
    </div>
  ),
}))

describe('Session', () => {
  it('passes through basePath', () => {
    render(
      <Session basePath="/api/custom-auth" session={{ user: { id: 'u1' } }}>
        <span>child content</span>
      </Session>
    )

    expect(screen.getByTestId('session-provider')).toHaveAttribute(
      'data-base-path',
      '/api/custom-auth'
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('renders without a basePath', () => {
    render(
      <Session session={{ user: { id: 'u1' } }}>
        <span>child content</span>
      </Session>
    )

    expect(screen.getByTestId('session-provider')).not.toHaveAttribute(
      'data-base-path'
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
