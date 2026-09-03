import EventLog from './EventLog'

import { render } from '@testing-library/react'

jest.mock('@/lib/event', () => [])

jest.mock('@/hooks/usePopup', () => {
  return function mockUsePopup() {
    return {
      show: jest.fn(),
      close: jest.fn(),
      isOpen: false,
      popup: null,
    }
  }
})

jest.mock('@/components/ResourceList', () => {
  return function MockResourceList({ exportRoute, listRoute }) {
    return (
      <div data-testid="resource-list">
        <div data-testid="list-route">{listRoute}</div>
        <div data-testid="export-route">{exportRoute || 'null'}</div>
      </div>
    )
  }
})

jest.mock('@/hooks/useInitial', () => (fn) => fn())

describe('EventLog', () => {
  it('should have export route configured', () => {
    const { getByTestId } = render(<EventLog />)

    const exportRoute = getByTestId('export-route')

    expect(exportRoute.textContent).toBe('/api/v1/event/log/export')
  })

  it('should apply filters to both list and export routes', () => {
    const eventTypes = ['user_login', 'user_logout']
    const contextFilters = { botId: 'test-bot-id' }

    const { getByTestId } = render(
      <EventLog eventTypes={eventTypes} contextFilters={contextFilters} />
    )

    const listRoute = getByTestId('list-route')
    const exportRoute = getByTestId('export-route')

    expect(listRoute.textContent).toContain('/api/v1/event/log/list?')
    expect(listRoute.textContent).toContain('type=user_login%2Cuser_logout')
    expect(listRoute.textContent).toContain('botId=test-bot-id')

    expect(exportRoute.textContent).toContain('/api/v1/event/log/export?')
    expect(exportRoute.textContent).toContain('type=user_login%2Cuser_logout')
    expect(exportRoute.textContent).toContain('botId=test-bot-id')
  })

  it('should use base routes when no filters are applied', () => {
    const { getByTestId } = render(<EventLog />)

    const listRoute = getByTestId('list-route')
    const exportRoute = getByTestId('export-route')

    expect(listRoute.textContent).toBe('/api/v1/event/log/list')
    expect(exportRoute.textContent).toBe('/api/v1/event/log/export')
  })
})
