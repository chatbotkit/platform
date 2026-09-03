import AuditLog from './AuditLog'

import { render } from '@testing-library/react'

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
  return function MockResourceList({ exportRoute, listRoute, ..._props }) {
    return (
      <div data-testid="resource-list">
        <div data-testid="list-route">{listRoute}</div>
        <div data-testid="export-route">{exportRoute || 'null'}</div>
      </div>
    )
  }
})
jest.mock('@/hooks/useInitial', () => (fn) => fn())

describe('AuditLog', () => {
  it('should have export route configured', () => {
    const { getByTestId } = render(<AuditLog />)

    const exportRoute = getByTestId('export-route')

    expect(exportRoute.textContent).toBe('/api/v1/audit/log/export')
  })

  it('should apply filters to both list and export routes', () => {
    const auditActions = ['CREATE', 'UPDATE']
    const contextFilters = { botId: 'test-bot-id' }

    const { getByTestId } = render(
      <AuditLog auditActions={auditActions} contextFilters={contextFilters} />
    )

    const listRoute = getByTestId('list-route')
    const exportRoute = getByTestId('export-route')

    expect(listRoute.textContent).toContain('/api/v1/audit/log/list?')
    expect(listRoute.textContent).toContain('action=CREATE%2CUPDATE')
    expect(listRoute.textContent).toContain('botId=test-bot-id')

    expect(exportRoute.textContent).toContain('/api/v1/audit/log/export?')
    expect(exportRoute.textContent).toContain('action=CREATE%2CUPDATE')
    expect(exportRoute.textContent).toContain('botId=test-bot-id')
  })

  it('should use base routes when no filters are applied', () => {
    const { getByTestId } = render(<AuditLog />)

    const listRoute = getByTestId('list-route')
    const exportRoute = getByTestId('export-route')

    expect(listRoute.textContent).toBe('/api/v1/audit/log/list')
    expect(exportRoute.textContent).toBe('/api/v1/audit/log/export')
  })
})
