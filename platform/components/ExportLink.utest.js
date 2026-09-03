import React from 'react'

import { saveData } from '@/lib/save'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

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
  GlobalRootPortal: ({ children }) => <div>{children}</div>,
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('ExportLink', () => {
  let mockFetch
  let mockOpenPopup
  let mockClosePopup

  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch = jest.fn()
    mockOpenPopup = jest.fn()
    mockClosePopup = jest.fn()

    useFetch.mockReturnValue({
      fetch: mockFetch,
    })

    usePopup.mockImplementation(({ actions }) => ({
      popup: null,
      openPopup: mockOpenPopup,
      closePopup: mockClosePopup,
      // Store actions for later access
      actions,
    }))
  })

  describe('rendering', () => {
    it('should render with title', () => {
      render(<ExportLink path="/api/export" title="Export Data" />)

      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })

    it('should render children', () => {
      render(
        <ExportLink path="/api/export">
          <span>Click to export</span>
        </ExportLink>
      )

      expect(screen.getByText('Click to export')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ExportLink
          path="/api/export"
          title="Export"
          className="custom-class"
        />
      )

      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })

    it('should apply disabled class when disabled', () => {
      const { container } = render(
        <ExportLink path="/api/export" title="Export" disabled />
      )

      expect(container.querySelector('.disabled')).toBeInTheDocument()
    })

    it('should pass additional props to div', () => {
      render(
        <ExportLink
          path="/api/export"
          title="Export"
          data-testid="export-link"
        />
      )

      expect(screen.getByTestId('export-link')).toBeInTheDocument()
    })
  })

  describe('useFetch hook initialization', () => {
    it('should initialize useFetch with correct options', () => {
      render(<ExportLink path="/api/export" name="test-data" />)

      expect(useFetch).toHaveBeenCalledWith({
        loadingMessage: 'Exporting test-data...',
        failureMessage: true,
        loadingMessageDuration: 3.6e6,
        dataType: 'text',
      })
    })

    it('should use default name when not provided', () => {
      render(<ExportLink path="/api/export" />)

      expect(useFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          loadingMessage: 'Exporting data...',
        })
      )
    })
  })

  describe('usePopup hook initialization', () => {
    it('should initialize usePopup with title and description', () => {
      render(
        <ExportLink
          path="/api/export"
          title="Export Data"
          description="Select format"
        />
      )

      expect(usePopup).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Export Data',
          closePopupOnClickOutside: false,
        })
      )
    })

    it('should configure popup actions for JSON and CSV', () => {
      render(<ExportLink path="/api/export" />)

      const callArgs = usePopup.mock.calls[0][0]

      expect(callArgs.actions).toHaveProperty('Export JSON')
      expect(callArgs.actions).toHaveProperty('Export CSV')
    })
  })

  describe('launch interaction', () => {
    it('should open popup when clicked', () => {
      render(
        <ExportLink
          path="/api/export"
          title="Export"
          description="Test description"
        />
      )

      fireEvent.click(screen.getByText('Export'))

      expect(mockOpenPopup).toHaveBeenCalledWith(<div>Test description</div>)
    })

    it('should not open popup when disabled', () => {
      render(<ExportLink path="/api/export" title="Export" disabled />)

      fireEvent.click(screen.getByText('Export'))

      expect(mockOpenPopup).not.toHaveBeenCalled()
    })

    it('should render description in popup', () => {
      render(
        <ExportLink
          path="/api/export"
          title="Export"
          description="Choose your format"
        />
      )

      fireEvent.click(screen.getByText('Export'))

      const popupContent = mockOpenPopup.mock.calls[0][0]

      expect(popupContent.props.children).toBe('Choose your format')
    })
  })

  describe('JSON export', () => {
    it('should fetch data with JSON accept header', async () => {
      mockFetch.mockResolvedValue({
        data: '{"name":"test"}\n{"name":"test2"}',
      })

      render(<ExportLink path="/api/export" name="users" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(mockFetch).toHaveBeenCalledWith('/api/export', {
        headers: {
          accept: 'application/jsonl',
        },
      })
    })

    it('should convert JSONL to JSON array', async () => {
      mockFetch.mockResolvedValue({
        data: '{"id":1}\n{"id":2}\n{"id":3}',
      })

      render(<ExportLink path="/api/export" name="items" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(saveData).toHaveBeenCalledWith(
        '[\n{"id":1},\n{"id":2},\n{"id":3}\n]',
        {
          name: 'items.json',
          type: 'application/json',
        }
      )
    })

    it('should use kebab-case for filename', async () => {
      mockFetch.mockResolvedValue({ data: '{"test":"data"}' })

      render(<ExportLink path="/api/export" name="User Data" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(saveData).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: 'user-data.json',
        })
      )
    })

    it('should close popup after successful export', async () => {
      mockFetch.mockResolvedValue({ data: '{"test":"data"}' })

      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(mockClosePopup).toHaveBeenCalled()
    })

    it('should handle empty JSONL data', async () => {
      mockFetch.mockResolvedValue({ data: '' })

      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(saveData).toHaveBeenCalledWith('[\n\n]', expect.any(Object))
    })
  })

  describe('CSV export', () => {
    it('should fetch data with CSV accept header', async () => {
      mockFetch.mockResolvedValue({ data: 'name,age\nJohn,30\nJane,25' })

      render(<ExportLink path="/api/export" name="users" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(mockFetch).toHaveBeenCalledWith('/api/export', {
        headers: {
          accept: 'text/csv',
        },
      })
    })

    it('should save CSV data directly', async () => {
      const csvData = 'id,name\n1,Test\n2,Test2'

      mockFetch.mockResolvedValue({ data: csvData })

      render(<ExportLink path="/api/export" name="records" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(saveData).toHaveBeenCalledWith(csvData, {
        name: 'records.csv',
        type: 'text/csv',
      })
    })

    it('should use kebab-case for CSV filename', async () => {
      mockFetch.mockResolvedValue({ data: 'test,data' })

      render(<ExportLink path="/api/export" name="Test Records" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(saveData).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: 'test-records.csv',
        })
      )
    })

    it('should close popup after successful CSV export', async () => {
      mockFetch.mockResolvedValue({ data: 'test,data' })

      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(mockClosePopup).toHaveBeenCalled()
    })

    it('should mark CSV as default action', () => {
      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      expect(actions['Export CSV'].default).toBe(true)
    })

    it('should handle empty CSV data', async () => {
      mockFetch.mockResolvedValue({ data: '' })

      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(saveData).toHaveBeenCalledWith('', expect.any(Object))
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace in JSONL data', async () => {
      mockFetch.mockResolvedValue({
        data: '  {"id":1}  \n  {"id":2}  \n  ',
      })

      render(<ExportLink path="/api/export" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export JSON'].fn()

      expect(saveData).toHaveBeenCalledWith(
        '[\n{"id":1}  ,\n  {"id":2}\n]',
        expect.any(Object)
      )
    })

    it('should handle paths with query parameters', async () => {
      mockFetch.mockResolvedValue({ data: 'test' })

      render(<ExportLink path="/api/export?filter=active" />)

      const { actions } = usePopup.mock.calls[0][0]

      await actions['Export CSV'].fn()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/export?filter=active',
        expect.any(Object)
      )
    })
  })
})
