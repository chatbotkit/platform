import Layout from './layout'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/headers', () => ({
  headers: jest.fn(() => new Headers()),
}))

jest.mock('@/lib/app.router.app.config', () => ({
  getPublicAppConfig: jest.fn(),
  getUserAppConfig: jest.fn(),
}))

jest.mock('@/lib/app.router.app.manifest', () => ({
  getAppManifestPath: jest.fn(() => '/apps/eventlog/manifest'),
}))

jest.mock('@/layouts/App', () => ({
  __esModule: true,
  default: ({ children, ...props }) => (
    <div data-testid="app-layout" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}))

jest.mock('./app.manifest', () => ({
  name: 'Event Log',
  description: 'Audit log viewer',
}))

describe('eventlog/layout', () => {
  it('should disable the shared top navigation chrome for eventlog', async () => {
    const { getUserAppConfig } = jest.requireMock('@/lib/app.router.app.config')

    getUserAppConfig.mockResolvedValue({ theme: 'system' })

    render(await Layout({ children: <div>Event log</div> }))

    const props = JSON.parse(screen.getByTestId('app-layout').dataset.props)

    expect(props.slug).toBe('eventlog')
    expect(props.showHeader).toBe(false)
    expect(props.showFooter).toBe(false)
    expect(props.showNav).toBe(false)
    expect(props.config).toEqual({ theme: 'system' })
  })
})
