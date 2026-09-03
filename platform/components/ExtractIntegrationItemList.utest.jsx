/* eslint-disable @typescript-eslint/no-require-imports */
import ExtractIntegrationItemList from './ExtractIntegrationItemList'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/object', () => ({
  revalue: jest.fn((obj) => obj),
}))

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => (
    <div data-testid="global-root-portal">{children}</div>
  ),
}))

jest.mock('@/components/ObjectView', () => ({
  __esModule: true,
  default: ({ object, className }) => (
    <div data-testid="object-view" className={className}>
      {JSON.stringify(object)}
    </div>
  ),
}))

jest.mock('@/components/ResourceList', () => ({
  __esModule: true,
  default: ({
    kind,
    listRoute,
    exportRoute,
    deleteRoute,
    instanceRoute,
    filter,
    nameMapper,
    descriptionMapper,
    onItemClick,
  }) => (
    <div data-testid="resource-list">
      <div data-testid="list-kind">{kind}</div>
      <div data-testid="list-route">{listRoute}</div>
      <div data-testid="export-route">{exportRoute}</div>
      <button
        type="button"
        onClick={() =>
          onItemClick({
            id: 'test-id',
            name: 'Test Item',
            description: 'Test Description',
          })
        }
      >
        Test Item
      </button>
    </div>
  ),
}))

jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    popup: <div data-testid="popup-content">Popup</div>,
    openPopup: jest.fn(),
  })),
}))

const { default: usePopup } = require('@/hooks/usePopup')

describe('ExtractIntegrationItemList', () => {
  const integrationId = 'test-integration-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render ResourceList component', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should render GlobalRootPortal with popup', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      expect(screen.getByTestId('global-root-portal')).toBeInTheDocument()
      expect(screen.getByTestId('popup-content')).toBeInTheDocument()
    })

    it('should pass correct kind to ResourceList', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      expect(screen.getByTestId('list-kind')).toHaveTextContent(
        'extract integration item'
      )
    })
  })

  describe('route generation', () => {
    it('should generate correct list route', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        `/api/v1/integration/extract/${integrationId}/item/list`
      )
    })

    it('should generate correct export route', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      expect(screen.getByTestId('export-route')).toHaveTextContent(
        `/api/v1/integration/extract/${integrationId}/item/export`
      )
    })

    it('should update routes when integrationId changes', () => {
      const { rerender } = render(
        <ExtractIntegrationItemList integrationId="first-id" />
      )

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/integration/extract/first-id/item/list'
      )

      rerender(<ExtractIntegrationItemList integrationId="second-id" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/integration/extract/second-id/item/list'
      )
    })
  })

  describe('nameMapper', () => {
    it('should render component without errors', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })

  describe('descriptionMapper', () => {
    it('should render component without errors', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })

  describe('handleItemClick', () => {
    it('should call openPopup when item is clicked', () => {
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div data-testid="popup-content">Popup</div>,
        openPopup: mockOpenPopup,
      })

      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      const button = screen.getByRole('button', { name: 'Test Item' })

      fireEvent.click(button)

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })

    it('should open popup with correct title', () => {
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div data-testid="popup-content">Popup</div>,
        openPopup: mockOpenPopup,
      })

      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      const button = screen.getByRole('button', { name: 'Test Item' })

      fireEvent.click(button)

      const callArgs = mockOpenPopup.mock.calls[0]

      expect(callArgs[1].title).toBe('Test Item')
    })

    it('should open popup with correct description', () => {
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div data-testid="popup-content">Popup</div>,
        openPopup: mockOpenPopup,
      })

      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      const button = screen.getByRole('button', { name: 'Test Item' })

      fireEvent.click(button)

      const callArgs = mockOpenPopup.mock.calls[0]

      expect(callArgs[1].description).toBe('Test Description')
    })

    it('should open popup with cancel button caption', () => {
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div data-testid="popup-content">Popup</div>,
        openPopup: mockOpenPopup,
      })

      render(<ExtractIntegrationItemList integrationId={integrationId} />)

      const button = screen.getByRole('button', { name: 'Test Item' })

      fireEvent.click(button)

      const callArgs = mockOpenPopup.mock.calls[0]

      expect(callArgs[1].cancelButtonCaption).toBe('Close')
    })
  })

  describe('ResourceList configuration', () => {
    it('should pass null for deleteRoute', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass null for instanceRoute', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass filter as false', () => {
      render(<ExtractIntegrationItemList integrationId={integrationId} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty integrationId', () => {
      render(<ExtractIntegrationItemList integrationId="" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/integration/extract//item/list'
      )
    })

    it('should handle special characters in integrationId', () => {
      render(
        <ExtractIntegrationItemList integrationId="test-integration-with-special-chars-123" />
      )

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/integration/extract/test-integration-with-special-chars-123/item/list'
      )
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      render(
        <ExtractIntegrationItemList
          integrationId={integrationId}
          data-testid="custom-test-id"
        />
      )

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })
})
