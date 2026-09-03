import useTextareaSelection from '@/hooks/useTextareaSelection'

import TextareaQuickEditTools from './TextareaQuickEditTools'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// @note mock ResizeObserver for tests
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// @note mock AutoTextarea to avoid ResizeObserver issues
jest.mock('@/components/AutoTextarea', () => {
  return function MockAutoTextarea({ className, value, onChange, ...props }) {
    return (
      <textarea
        className={className}
        value={value}
        onChange={onChange}
        {...props}
      />
    )
  }
})

// @note mock the useFetch hook
jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({
    fetch: jest.fn().mockResolvedValue({
      error: null,
      data: { text: 'Transformed text' },
    }),
    loading: false,
  }),
}))

// @note mock the GlobalRootPortal to render children directly
jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => (
    <div data-testid="portal">{children}</div>
  ),
}))

// @note mock FloatingBox to render children directly
jest.mock('@/components/FloatingBox', () => {
  return function MockFloatingBox({ children }) {
    return (
      <div data-testid="floating-box">
        {typeof children === 'function'
          ? children({ close: jest.fn() })
          : children}
      </div>
    )
  }
})

// @note mock useTextareaSelection
jest.mock('@/hooks/useTextareaSelection', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('TextareaQuickEditTools', () => {
  let mockTextarea
  let setValue

  beforeEach(() => {
    jest.clearAllMocks()

    setValue = jest.fn()

    mockTextarea = document.createElement('textarea')
    mockTextarea.value = 'Hello World, this is a test'

    document.body.appendChild(mockTextarea)

    // @note default mock implementation - no selection
    useTextareaSelection.mockReturnValue({
      clientRect: undefined,
      textContent: undefined,
      selectionStart: undefined,
      selectionEnd: undefined,
      isCollapsed: true,
    })
  })

  afterEach(() => {
    if (mockTextarea && mockTextarea.parentNode) {
      document.body.removeChild(mockTextarea)
    }

    jest.useRealTimers()
  })

  describe('when no text is selected', () => {
    it('should not render anything', () => {
      const { container } = render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
        />
      )

      // @note should not render the portal or tool button
      expect(screen.queryByTestId('portal')).not.toBeInTheDocument()
    })
  })

  describe('when text is selected', () => {
    beforeEach(() => {
      jest.useFakeTimers()

      useTextareaSelection.mockReturnValue({
        clientRect: {
          top: 100,
          left: 100,
          right: 200,
          bottom: 120,
          width: 100,
          height: 20,
          x: 100,
          y: 100,
        },
        textContent: 'Hello',
        selectionStart: 0,
        selectionEnd: 5,
        isCollapsed: false,
      })
    })

    it('should show Quick Edit button after delay', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={500}
        />
      )

      // @note button should not be visible immediately
      expect(screen.queryByText('Quick Edit')).not.toBeInTheDocument()

      // @note advance timers past the delay
      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })
    })

    it('should show Quick Edit button immediately when delay is 0', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })
    })

    it('should not show button when disabled', async () => {
      jest.advanceTimersByTime(500)

      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          disabled={true}
          delay={0}
        />
      )

      expect(screen.queryByText('Quick Edit')).not.toBeInTheDocument()
    })

    it('should open edit form when Quick Edit button is clicked', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })

      // @note use mouseDown because the button uses onMouseDown to prevent selection loss
      fireEvent.mouseDown(screen.getByText('Quick Edit'))

      await waitFor(() => {
        expect(screen.getByTestId('floating-box')).toBeInTheDocument()
      })
    })
  })

  describe('when form is open', () => {
    beforeEach(() => {
      jest.useFakeTimers()

      useTextareaSelection.mockReturnValue({
        clientRect: {
          top: 100,
          left: 100,
          right: 200,
          bottom: 120,
          width: 100,
          height: 20,
          x: 100,
          y: 100,
        },
        textContent: 'Hello',
        selectionStart: 0,
        selectionEnd: 5,
        isCollapsed: false,
      })
    })

    it('should show the selected text preview', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })

      // @note use mouseDown because the button uses onMouseDown to prevent selection loss
      fireEvent.mouseDown(screen.getByText('Quick Edit'))

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })
    })

    it('should have an instruction input field', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })

      // @note use mouseDown because the button uses onMouseDown to prevent selection loss
      fireEvent.mouseDown(screen.getByText('Quick Edit'))

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/make it more professional/i)
        ).toBeInTheDocument()
      })
    })

    it('should have Cancel and Apply buttons', async () => {
      render(
        <TextareaQuickEditTools
          textarea={mockTextarea}
          value={mockTextarea.value}
          setValue={setValue}
          delay={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Quick Edit')).toBeInTheDocument()
      })

      // @note use mouseDown because the button uses onMouseDown to prevent selection loss
      fireEvent.mouseDown(screen.getByText('Quick Edit'))

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
        expect(screen.getByText('Apply')).toBeInTheDocument()
      })
    })
  })
})
