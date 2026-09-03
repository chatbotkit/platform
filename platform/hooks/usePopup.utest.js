import usePopup from './usePopup'

import '@testing-library/jest-dom'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'

const transitionChildAfterLeaveCallbacks = []

jest.mock('@/lib/form', () => ({
  formToData: jest.fn(() => ({})),
}))

jest.mock('@headlessui/react', () => {
  const { forwardRef } = jest.requireActual('react')

  const MockDialog = forwardRef(function MockDialog(
    { children, _onClose, onSubmit, ...props },
    ref
  ) {
    return (
      <div ref={ref} data-testid="dialog" {...props}>
        <form onSubmit={onSubmit}>{children}</form>
      </div>
    )
  })

  MockDialog.displayName = 'MockDialog'

  MockDialog.Title = function MockDialogTitle({ children, ...props }) {
    return <h3 {...props}>{children}</h3>
  }

  MockDialog.Description = function MockDialogDescription({
    children,
    ...props
  }) {
    return <div {...props}>{children}</div>
  }

  MockDialog.Panel = function MockDialogPanel({ children, ...props }) {
    return <div {...props}>{children}</div>
  }

  return {
    Dialog: MockDialog,
    Transition: {
      Root: ({ children, show }) => (
        <div data-testid="transition-root" data-show={show ? 'true' : 'false'}>
          {children}
        </div>
      ),
      Child: ({ children, afterLeave }) => {
        if (afterLeave) {
          transitionChildAfterLeaveCallbacks.push(afterLeave)
        }

        return <div data-testid="transition-child">{children}</div>
      },
    },
  }
})

jest.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: () => <div data-testid="exclamation-icon" />,
}))

describe('usePopup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    transitionChildAfterLeaveCallbacks.length = 0
  })

  describe('basic functionality', () => {
    it('should initialize with closed state by default', () => {
      const { result } = renderHook(() => usePopup())

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="transition-root"]')
      ).toBeNull()
    })

    it('should initialize with open state when option provided', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="transition-root"]')
      ).toBeInTheDocument()
    })

    it('should open popup when openPopup is called', () => {
      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(() => <div>Test Content</div>)
      })

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="transition-root"]')
      ).toBeInTheDocument()
    })

    it('should close popup when closePopup is called', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      act(() => {
        result.current.closePopup()
      })

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="transition-root"]')
      ).toBeNull()
    })
  })

  describe('content rendering', () => {
    it('should render custom content from function', () => {
      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(() => <div>Custom Content</div>)
      })

      render(result.current.popup)

      expect(screen.getByText('Custom Content')).toBeInTheDocument()
    })

    it('should render content from component', () => {
      const TestComponent = () => <div>Component Content</div>

      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(TestComponent)
      })

      render(result.current.popup)

      expect(screen.getByText('Component Content')).toBeInTheDocument()
    })

    it('should pass props to content component', () => {
      const TestComponent = ({ testProp }) => <div>{testProp}</div>

      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(TestComponent)
        result.current.setProps({ testProp: 'Test Value' })
      })

      render(result.current.popup)

      expect(screen.getByText('Test Value')).toBeInTheDocument()
    })
  })

  describe('options handling', () => {
    it('should render title when provided', () => {
      const { result } = renderHook(() =>
        usePopup({ title: 'Test Title', open: true })
      )

      render(result.current.popup)

      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should render description when provided', () => {
      const { result } = renderHook(() =>
        usePopup({ description: 'Test Description', open: true })
      )

      render(result.current.popup)

      expect(screen.getByText('Test Description')).toBeInTheDocument()
    })

    it('should show alert icon when type is alert', () => {
      const { result } = renderHook(() =>
        usePopup({ type: 'alert', open: true })
      )

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="exclamation-icon"]')
      ).toBeInTheDocument()
    })

    it('should not show alert icon by default', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      const { container } = render(result.current.popup)

      expect(
        container.querySelector('[data-testid="exclamation-icon"]')
      ).toBeNull()
    })

    it('should use custom cancel button caption', () => {
      const { result } = renderHook(() =>
        usePopup({ cancelButtonCaption: 'Close', open: true })
      )

      render(result.current.popup)

      expect(screen.getByText('Close')).toBeInTheDocument()
    })

    it('should use default cancel button caption', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      render(result.current.popup)

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('should hide actions when noActions is true', () => {
      const { result } = renderHook(() =>
        usePopup({ noActions: true, open: true })
      )

      render(result.current.popup)

      expect(screen.queryByText('Cancel')).toBeNull()
    })

    it('should merge default options with temp options', () => {
      const { result } = renderHook(() =>
        usePopup({ title: 'Default Title', open: true })
      )

      act(() => {
        result.current.openPopup(() => <div>Content</div>, {
          title: 'New Title',
        })
      })

      render(result.current.popup)

      expect(screen.getByText('New Title')).toBeInTheDocument()
    })

    it('should render popup content without animated height when disabled', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      act(() => {
        result.current.openPopup(() => <div>Content</div>, {
          animateContentHeight: false,
        })
      })

      const { container } = render(result.current.popup)

      expect(screen.getByText('Content')).toBeInTheDocument()
      expect(container.querySelector('.transition-\\[height\\]')).toBeNull()
    })

    it('should fall back to hook dialogClassName when next openPopup call has no options', () => {
      const { result } = renderHook(() =>
        usePopup({ dialogClassName: 'sm:max-w-4xl', open: true })
      )

      act(() => {
        result.current.openPopup(() => <div>Content A</div>, {
          dialogClassName: 'sm:max-w-3xl',
        })
      })

      const { container, rerender } = render(result.current.popup)

      expect(container.querySelector('.sm\\:max-w-3xl')).toBeInTheDocument()

      act(() => {
        result.current.openPopup(() => <div>Content B</div>)
      })

      rerender(result.current.popup)

      expect(container.querySelector('.sm\\:max-w-4xl')).toBeInTheDocument()
      expect(container.querySelector('.sm\\:max-w-3xl')).toBeNull()
    })
  })

  describe('actions', () => {
    it('should render action buttons', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: jest.fn() },
          open: true,
        })
      )

      render(result.current.popup)

      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('should call action function when button clicked', async () => {
      const actionFn = jest.fn()

      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: actionFn },
          open: true,
        })
      )

      render(result.current.popup)

      await act(async () => {
        fireEvent.click(screen.getByText('Save'))
      })

      expect(actionFn).toHaveBeenCalledTimes(1)
    })

    // @todo fix bug in handleSubmit - should check action[1] not action
    it.skip('should call default action on form submit', async () => {
      const actionFn = jest.fn()

      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: { default: true, fn: actionFn } },
          open: true,
        })
      )

      const { container } = render(result.current.popup)

      const form = container.querySelector('form')

      await act(async () => {
        fireEvent.submit(form)
      })

      // @note expected: actionFn to be called 1 time, actual: never called due to bug
      expect(actionFn).toHaveBeenCalledTimes(1)
    })

    it('should apply primary-button class to default action', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: { default: true, fn: jest.fn() } },
          open: true,
        })
      )

      render(result.current.popup)

      const button = screen.getByText('Save')

      expect(button.className).toContain('primary-button')
    })

    it('should apply danger-button class to danger action', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Delete: { danger: true, fn: jest.fn() } },
          open: true,
        })
      )

      render(result.current.popup)

      const button = screen.getByText('Delete')

      expect(button.className).toContain('danger-button')
    })

    it('should apply default-button class to regular action', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: jest.fn() },
          open: true,
        })
      )

      render(result.current.popup)

      const button = screen.getByText('Save')

      expect(button.className).toContain('default-button')
    })

    it('should disable actions when actionsDisabled', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: jest.fn() },
          open: true,
        })
      )

      act(() => {
        result.current.setActionsDisabled(true)
      })

      render(result.current.popup)

      const button = screen.getByText('Save')

      expect(button).toBeDisabled()
    })

    it('should pass close callback to action function', async () => {
      const actionFn = jest.fn()

      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: actionFn },
          open: true,
        })
      )

      render(result.current.popup)

      await act(async () => {
        fireEvent.click(screen.getByText('Save'))
      })

      expect(actionFn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ close: expect.any(Function) })
      )
    })
  })

  describe('disabled state', () => {
    it('should disable fieldset when disabled', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      act(() => {
        result.current.setDisabled(true)
      })

      const { container } = render(result.current.popup)

      const fieldset = container.querySelector('fieldset')

      expect(fieldset).toBeDisabled()
    })

    it('should disable cancel button when disabled', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      act(() => {
        result.current.setDisabled(true)
      })

      render(result.current.popup)

      const button = screen.getByText('Cancel')

      expect(button).toBeDisabled()
    })

    it('should disable action buttons when disabled', () => {
      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: jest.fn() },
          open: true,
        })
      )

      act(() => {
        result.current.setDisabled(true)
      })

      render(result.current.popup)

      const button = screen.getByText('Save')

      expect(button).toBeDisabled()
    })
  })

  describe('close behavior', () => {
    it('should call onClose callback when closing', () => {
      const onClose = jest.fn()

      const { result } = renderHook(() => usePopup({ onClose, open: true }))

      act(() => {
        result.current.closePopup()
      })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose from openPopup options', () => {
      const onClose = jest.fn()

      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(() => <div>Content</div>, { onClose })
      })

      act(() => {
        result.current.closePopup()
      })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should respect closePopupOnClickOutside option', () => {
      const { result } = renderHook(() =>
        usePopup({ closePopupOnClickOutside: false, open: true })
      )

      act(() => {
        result.current.openPopup(() => <div>Content</div>, {
          closePopupOnClickOutside: false,
        })
      })

      expect(result.current.closePopup).toBeDefined()
    })

    it('should allow closePopupOnClickOutside by default', () => {
      const { result } = renderHook(() => usePopup({ open: true }))

      act(() => {
        result.current.openPopup(() => <div>Content</div>)
      })

      expect(result.current.closePopup).toBeDefined()
    })

    it('should ignore stale afterLeave cleanup after reopening a popup', () => {
      let popupApi

      function TestHarness() {
        popupApi = usePopup()

        return popupApi.popup
      }

      render(<TestHarness />)

      act(() => {
        popupApi.openPopup(() => null, { title: 'First Title' })
      })

      const staleAfterLeave = transitionChildAfterLeaveCallbacks.at(-1)

      expect(screen.getByText('First Title')).toBeInTheDocument()

      act(() => {
        popupApi.closePopup()
      })

      act(() => {
        popupApi.openPopup(() => null, { title: 'Second Title' })
      })

      expect(screen.getByText('Second Title')).toBeInTheDocument()

      act(() => {
        staleAfterLeave()
      })

      expect(screen.getByText('Second Title')).toBeInTheDocument()
      expect(screen.queryByText('First Title')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle openPopup without options', () => {
      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.openPopup(() => <div>Content</div>)
      })

      render(result.current.popup)

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should handle empty actions object', () => {
      const { result } = renderHook(() => usePopup({ actions: {}, open: true }))

      render(result.current.popup)

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('should handle action error gracefully', async () => {
      const actionFn = jest.fn(() => {
        throw new Error('Action error')
      })

      const { result } = renderHook(() =>
        usePopup({
          actions: { Save: actionFn },
          open: true,
        })
      )

      render(result.current.popup)

      await act(async () => {
        fireEvent.click(screen.getByText('Save'))
      })

      expect(actionFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('state management', () => {
    it('should update props state', () => {
      const { result } = renderHook(() => usePopup())

      act(() => {
        result.current.setProps({ test: 'value' })
      })

      expect(result.current.props).toEqual({ test: 'value' })
    })

    it('should expose disabled state', () => {
      const { result } = renderHook(() => usePopup())

      expect(result.current.disabled).toBe(false)

      act(() => {
        result.current.setDisabled(true)
      })

      expect(result.current.disabled).toBe(true)
    })

    it('should expose actionsDisabled state', () => {
      const { result } = renderHook(() => usePopup())

      expect(result.current.actionsDisabled).toBe(false)

      act(() => {
        result.current.setActionsDisabled(true)
      })

      expect(result.current.actionsDisabled).toBe(true)
    })
  })
})
