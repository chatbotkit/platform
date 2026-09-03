/* eslint-disable @typescript-eslint/no-require-imports */
import ExportLink from './ExportLink'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/save', () => ({
  saveData: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  toKebabCase: jest.fn((str) => str.toLowerCase().replace(/\s+/g, '-')),
}))

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => (
    <div data-testid="portal">{children}</div>
  ),
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fetch: jest.fn(() => Promise.resolve({ data: 'line1\nline2\nline3' })),
  })),
}))

jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: jest.fn((config) => {
    const mockOpenPopup = jest.fn((content) => {
      const div = document.createElement('div')

      div.setAttribute('data-testid', 'popup-content')
      div.textContent = typeof content === 'string' ? content : 'popup'
      document.body.appendChild(div)
    })

    const mockClosePopup = jest.fn(() => {
      const popup = document.querySelector('[data-testid="popup-content"]')

      if (popup) {
        popup.remove()
      }
    })

    return {
      popup: <div data-testid="popup">Popup</div>,
      openPopup: mockOpenPopup,
      closePopup: mockClosePopup,
    }
  }),
}))

describe('ExportLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<ExportLink path="/api/export">Export</ExportLink>)

      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('should render title and children', () => {
      render(
        <ExportLink path="/api/export" title="Export Data">
          <span>Click to export</span>
        </ExportLink>
      )

      expect(screen.getByText('Export Data')).toBeInTheDocument()
      expect(screen.getByText('Click to export')).toBeInTheDocument()
    })

    it('should render GlobalRootPortal', () => {
      render(<ExportLink path="/api/export">Export</ExportLink>)

      expect(screen.getByTestId('portal')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('should apply disabled className when disabled', () => {
      const { container } = render(
        <ExportLink path="/api/export" disabled>
          Export
        </ExportLink>
      )

      const link = container.querySelector('.disabled')

      expect(link).toBeInTheDocument()
    })

    it('should not open popup when disabled', () => {
      const usePopup = require('@/hooks/usePopup').default
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div>Popup</div>,
        openPopup: mockOpenPopup,
        closePopup: jest.fn(),
      })

      render(
        <ExportLink path="/api/export" disabled>
          Export
        </ExportLink>
      )

      const link = screen.getByText('Export')

      fireEvent.click(link)

      expect(mockOpenPopup).not.toHaveBeenCalled()
    })
  })

  describe('popup interaction', () => {
    it('should open popup on click', () => {
      const usePopup = require('@/hooks/usePopup').default
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div>Popup</div>,
        openPopup: mockOpenPopup,
        closePopup: jest.fn(),
      })

      render(
        <ExportLink path="/api/export" description="Export your data">
          Export
        </ExportLink>
      )

      const link = screen.getByText('Export')

      fireEvent.click(link)

      expect(mockOpenPopup).toHaveBeenCalledWith(<div>Export your data</div>)
    })

    it('should initialize usePopup with correct config', () => {
      const usePopup = require('@/hooks/usePopup').default

      render(
        <ExportLink path="/api/export" title="Export Data">
          Export
        </ExportLink>
      )

      expect(usePopup).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Export Data',
          closePopupOnClickOutside: false,
        })
      )
    })

    it('should configure export actions in usePopup', () => {
      const usePopup = require('@/hooks/usePopup').default

      render(<ExportLink path="/api/export">Export</ExportLink>)

      const config = usePopup.mock.calls[0][0]

      expect(config.actions).toHaveProperty('Export JSON')
      expect(config.actions).toHaveProperty('Export CSV')
      expect(config.actions['Export CSV'].default).toBe(true)
    })
  })

  describe('useFetch initialization', () => {
    it('should initialize useFetch with correct config', () => {
      const useFetch = require('@/hooks/useFetch').default

      render(
        <ExportLink path="/api/export" name="My Data">
          Export
        </ExportLink>
      )

      expect(useFetch).toHaveBeenCalledWith({
        loadingMessage: 'Exporting My Data...',
        failureMessage: true,
        loadingMessageDuration: 3.6e6,
        dataType: 'text',
      })
    })

    it('should use default name when not provided', () => {
      const useFetch = require('@/hooks/useFetch').default

      render(<ExportLink path="/api/export">Export</ExportLink>)

      expect(useFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          loadingMessage: 'Exporting data...',
        })
      )
    })
  })

  describe('className and props forwarding', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ExportLink path="/api/export" className="custom-class">
          Export
        </ExportLink>
      )

      const link = container.querySelector('.custom-class')

      expect(link).toBeInTheDocument()
    })

    it('should forward additional props', () => {
      render(
        <ExportLink path="/api/export" data-testid="export-link">
          Export
        </ExportLink>
      )

      expect(screen.getByTestId('export-link')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty title', () => {
      render(
        <ExportLink path="/api/export" title="">
          Export
        </ExportLink>
      )

      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('should handle missing children', () => {
      render(<ExportLink path="/api/export" title="Export Data" />)

      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })

    it('should handle empty description', () => {
      const usePopup = require('@/hooks/usePopup').default
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div>Popup</div>,
        openPopup: mockOpenPopup,
        closePopup: jest.fn(),
      })

      render(
        <ExportLink path="/api/export" description="">
          Export
        </ExportLink>
      )

      const link = screen.getByText('Export')

      fireEvent.click(link)

      expect(mockOpenPopup).toHaveBeenCalled()

      const callArg = mockOpenPopup.mock.calls[0][0]

      expect(callArg.type).toBe('div')
      expect(callArg.props.children).toBe('')
    })
  })
})
