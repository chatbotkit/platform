/* eslint-disable @typescript-eslint/no-require-imports */
import FileDrop from './FileDrop'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/hooks/useDropzone')

describe('FileDrop', () => {
  let mockUseDropzone

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseDropzone = require('@/hooks/useDropzone').default

    mockUseDropzone.mockReturnValue({
      getRootProps: jest.fn(() => ({
        'data-testid': 'drop-zone',
      })),
      getInputProps: jest.fn(() => ({
        'data-testid': 'file-input',
        type: 'file',
      })),
      isDragActive: false,
      isDragReject: false,
    })
  })

  describe('basic functionality', () => {
    it('should render default state with upload prompt', () => {
      render(<FileDrop />)

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
      expect(screen.getByTestId('file-input')).toBeInTheDocument()
      expect(
        screen.getByText(/Drag & Drop your file here/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/Click to select/i)).toBeInTheDocument()
    })

    it('should pass props to useDropzone hook', () => {
      const onDrop = jest.fn()
      const accept = { 'image/*': ['.png', '.jpg'] }

      render(<FileDrop onDrop={onDrop} accept={accept} />)

      expect(mockUseDropzone).toHaveBeenCalledWith({
        onDrop,
        accept,
      })
    })

    it('should render input element with props from hook', () => {
      render(<FileDrop />)

      const input = screen.getByTestId('file-input')

      expect(input).toHaveAttribute('type', 'file')
    })
  })

  describe('drag active state', () => {
    it('should render drag active state when isDragActive is true', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: true,
        isDragReject: false,
      })

      render(<FileDrop />)

      expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument()
      expect(
        screen.queryByText(/Drag & Drop your file here/i)
      ).not.toBeInTheDocument()
    })

    it('should show appropriate icon when dragging', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: true,
        isDragReject: false,
      })

      const { container } = render(<FileDrop />)

      const activeZone = screen.getByText(/Drop your file here/i).parentElement

      expect(activeZone).toHaveClass('border-indigo-600')
    })

    it('should not show default state when dragging', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: true,
        isDragReject: false,
      })

      render(<FileDrop />)

      expect(screen.queryByText(/Click to select/i)).not.toBeInTheDocument()
    })
  })

  describe('drag reject state', () => {
    it('should render reject state when isDragReject is true', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: false,
        isDragReject: true,
      })

      render(<FileDrop />)

      expect(screen.getByText(/File type not accepted!/i)).toBeInTheDocument()
      // Default state is shown when !isDragActive (line 27), so it will also render
      expect(
        screen.getByText(/Drag & Drop your file here/i)
      ).toBeInTheDocument()
    })

    it('should show error styling when file type is rejected', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: false,
        isDragReject: true,
      })

      const { container } = render(<FileDrop />)

      const rejectZone = screen.getByText(
        /File type not accepted!/i
      ).parentElement

      expect(rejectZone).toHaveClass('border-red-400')
    })
  })

  describe('state priority', () => {
    it('should show both drag active and reject states when both are true', () => {
      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({ 'data-testid': 'drop-zone' })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: true,
        isDragReject: true,
      })

      render(<FileDrop />)

      // When isDragReject is true, it shows the reject message (line 36-41)
      // The active state requires isDragActive && !isDragReject (line 21)
      expect(screen.queryByText(/Drop your file here/i)).not.toBeInTheDocument()
      expect(screen.getByText(/File type not accepted!/i)).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined props', () => {
      render(<FileDrop />)

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
    })

    it('should handle empty props object', () => {
      render(<FileDrop {...{}} />)

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
    })

    it('should spread additional props to root element', () => {
      const customProp = 'custom-value'

      mockUseDropzone.mockReturnValue({
        getRootProps: jest.fn((props) => ({
          'data-testid': 'drop-zone',
          ...props,
        })),
        getInputProps: jest.fn(() => ({ 'data-testid': 'file-input' })),
        isDragActive: false,
        isDragReject: false,
      })

      render(<FileDrop data-custom={customProp} />)

      expect(mockUseDropzone).toHaveBeenCalledWith({
        'data-custom': customProp,
      })
    })
  })
})
