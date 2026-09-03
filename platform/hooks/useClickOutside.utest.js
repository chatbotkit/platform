import { useRef } from 'react'

import useClickOutside from './useClickOutside'

import { fireEvent, render } from '@testing-library/react'

describe('useClickOutside', () => {
  let handler

  beforeEach(() => {
    handler = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  function TestComponent({ onClickOutside }) {
    const ref = useRef(null)

    useClickOutside(ref, onClickOutside)

    return (
      <div>
        <div data-testid="outside">Outside</div>
        <div ref={ref} data-testid="inside">
          Inside
        </div>
      </div>
    )
  }

  describe('basic functionality', () => {
    it('should call handler when clicking outside', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // Simulate mousedown outside
      fireEvent.mouseDown(getByTestId('outside'))
      // Then click outside
      fireEvent.click(getByTestId('outside'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not call handler when clicking inside', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // Simulate mousedown inside
      fireEvent.mouseDown(getByTestId('inside'))
      // Then click inside
      fireEvent.click(getByTestId('inside'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not call handler when mousedown starts inside but click ends outside', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // Start inside
      fireEvent.mouseDown(getByTestId('inside'))
      // End outside
      fireEvent.click(getByTestId('outside'))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('touch events', () => {
    it('should handle touchstart events', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // Simulate touchstart outside
      fireEvent.touchStart(getByTestId('outside'))
      // Then click outside
      fireEvent.click(getByTestId('outside'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not call handler when touchstart starts inside', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // Start inside with touch
      fireEvent.touchStart(getByTestId('inside'))
      // End outside with click
      fireEvent.click(getByTestId('outside'))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle null ref', () => {
      function TestComponentNullRef({ onClickOutside }) {
        const ref = useRef(null)

        useClickOutside(ref, onClickOutside)

        return <div data-testid="outside">Outside</div>
      }

      const { getByTestId } = render(
        <TestComponentNullRef onClickOutside={handler} />
      )

      fireEvent.mouseDown(getByTestId('outside'))
      fireEvent.click(getByTestId('outside'))

      // Should not call handler when ref is null
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle multiple clicks', () => {
      const { getByTestId } = render(<TestComponent onClickOutside={handler} />)

      // First click
      fireEvent.mouseDown(getByTestId('outside'))
      fireEvent.click(getByTestId('outside'))

      // Second click
      fireEvent.mouseDown(getByTestId('outside'))
      fireEvent.click(getByTestId('outside'))

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')

      const { unmount } = render(<TestComponent onClickOutside={handler} />)

      const addCalls = addEventListenerSpy.mock.calls.length

      unmount()

      // Should remove same number of listeners as added
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(addCalls)

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('handler updates', () => {
    it('should use updated handler on subsequent clicks', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      const { getByTestId, rerender } = render(
        <TestComponent onClickOutside={handler1} />
      )

      // First click with handler1
      fireEvent.mouseDown(getByTestId('outside'))
      fireEvent.click(getByTestId('outside'))

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()

      // Update handler
      rerender(<TestComponent onClickOutside={handler2} />)

      // Second click with handler2
      fireEvent.mouseDown(getByTestId('outside'))
      fireEvent.click(getByTestId('outside'))

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })
})
