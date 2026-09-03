import { createRef } from 'react'

import SpaceSavingDiv from './SpaceSavingDiv'

import '@testing-library/jest-dom'
import { act, render, waitFor } from '@testing-library/react'

describe('SpaceSavingDiv', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render a div element', () => {
      const { container } = render(<SpaceSavingDiv />)

      expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
    })

    it('should apply custom className', () => {
      const { container } = render(<SpaceSavingDiv className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <SpaceSavingDiv data-testid="test-div" aria-label="Space saving" />
      )
      const div = container.firstChild

      expect(div).toHaveAttribute('data-testid', 'test-div')
      expect(div).toHaveAttribute('aria-label', 'Space saving')
    })
  })

  describe('content visibility', () => {
    it('should be visible when defaultHasContent is true', () => {
      const { container } = render(
        <SpaceSavingDiv defaultHasContent={true}>Hello World</SpaceSavingDiv>
      )

      expect(container.firstChild).not.toHaveClass('hidden')
    })

    it('should be hidden when it has no text content', () => {
      const { container } = render(<SpaceSavingDiv />)

      expect(container.firstChild).toHaveClass('hidden')
    })

    it('should be hidden when defaultHasContent is not provided', () => {
      const { container } = render(
        <SpaceSavingDiv>
          <div></div>
        </SpaceSavingDiv>
      )

      expect(container.firstChild).toHaveClass('hidden')
    })

    it('should detect content after initial render', async () => {
      const { container } = render(<SpaceSavingDiv />)
      const div = container.firstChild

      act(() => {
        div.textContent = 'New Text'
      })

      await waitFor(() => {
        expect(div).not.toHaveClass('hidden')
      })
    })
  })

  describe('defaultHasContent prop', () => {
    it('should respect defaultHasContent true', () => {
      const { container } = render(<SpaceSavingDiv defaultHasContent={true} />)

      expect(container.firstChild).not.toHaveClass('hidden')
    })

    it('should respect defaultHasContent false', () => {
      const { container } = render(
        <SpaceSavingDiv defaultHasContent={false}>Content</SpaceSavingDiv>
      )

      expect(container.firstChild).toHaveClass('hidden')
    })

    it('should update visibility when content is added', async () => {
      const { container, rerender } = render(
        <SpaceSavingDiv defaultHasContent={false} />
      )

      expect(container.firstChild).toHaveClass('hidden')

      rerender(<SpaceSavingDiv defaultHasContent={false}>Text</SpaceSavingDiv>)

      await waitFor(() => {
        expect(container.firstChild).not.toHaveClass('hidden')
      })
    })
  })

  describe('disabled prop', () => {
    it('should not observe mutations when disabled is true', () => {
      const { container, rerender } = render(<SpaceSavingDiv disabled={true} />)
      const div = container.firstChild

      rerender(<SpaceSavingDiv disabled={true}>Content</SpaceSavingDiv>)

      expect(div).toHaveClass('hidden')
    })

    it('should observe mutations when disabled is false', async () => {
      const { container, rerender } = render(
        <SpaceSavingDiv disabled={false} />
      )

      rerender(<SpaceSavingDiv disabled={false}>Content</SpaceSavingDiv>)

      await waitFor(() => {
        expect(container.firstChild).not.toHaveClass('hidden')
      })
    })

    it('should observe mutations by default when disabled is not provided', async () => {
      const { container, rerender } = render(<SpaceSavingDiv />)

      rerender(<SpaceSavingDiv>Content</SpaceSavingDiv>)

      await waitFor(() => {
        expect(container.firstChild).not.toHaveClass('hidden')
      })
    })
  })

  describe('MutationObserver behavior', () => {
    it('should detect when child content is added', async () => {
      const { container } = render(<SpaceSavingDiv />)
      const div = container.firstChild

      expect(div).toHaveClass('hidden')

      act(() => {
        div.textContent = 'New content'
      })

      await waitFor(() => {
        expect(div).not.toHaveClass('hidden')
      })
    })

    it('should detect when child content is removed', async () => {
      const { container } = render(
        <SpaceSavingDiv defaultHasContent={true}>Content</SpaceSavingDiv>
      )
      const div = container.firstChild

      expect(div).not.toHaveClass('hidden')

      act(() => {
        div.textContent = ''
      })

      await waitFor(() => {
        expect(div).toHaveClass('hidden')
      })
    })

    it('should detect when nested child is added', async () => {
      const { container } = render(<SpaceSavingDiv />)
      const div = container.firstChild

      expect(div).toHaveClass('hidden')

      act(() => {
        const child = document.createElement('span')

        child.textContent = 'Nested content'
        div.appendChild(child)
      })

      await waitFor(() => {
        expect(div).not.toHaveClass('hidden')
      })
    })

    it('should detect when nested child text changes', async () => {
      const { container } = render(
        <SpaceSavingDiv defaultHasContent={true}>
          <span id="nested">Initial</span>
        </SpaceSavingDiv>
      )
      const div = container.firstChild

      expect(div).not.toHaveClass('hidden')

      act(() => {
        const nested = div.querySelector('#nested')

        nested.textContent = ''
      })

      await waitFor(() => {
        expect(div).toHaveClass('hidden')
      })
    })
  })

  describe('ref forwarding', () => {
    it('should forward ref to the div element', () => {
      const ref = createRef()
      const { container } = render(<SpaceSavingDiv ref={ref} />)

      expect(ref.current).toBe(container.firstChild)
    })

    it('should allow ref access to DOM methods', () => {
      const ref = createRef()

      render(
        <SpaceSavingDiv ref={ref} defaultHasContent={true}>
          Content
        </SpaceSavingDiv>
      )

      expect(ref.current.textContent).toBe('Content')
      expect(ref.current.classList.contains('hidden')).toBe(false)
    })

    it('should work with function refs', () => {
      let refValue = null

      const setRef = (node) => {
        refValue = node
      }

      const { container } = render(<SpaceSavingDiv ref={setRef} />)

      expect(refValue).toBe(container.firstChild)
    })
  })

  describe('observer cleanup', () => {
    it('should disconnect observer on unmount', () => {
      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect')

      const { unmount } = render(<SpaceSavingDiv />)

      unmount()

      expect(disconnectSpy).toHaveBeenCalled()

      disconnectSpy.mockRestore()
    })

    it('should not disconnect observer when disabled changes', () => {
      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect')

      const { rerender } = render(<SpaceSavingDiv disabled={false} />)

      disconnectSpy.mockClear()

      rerender(<SpaceSavingDiv disabled={true} />)

      expect(disconnectSpy).toHaveBeenCalled()

      disconnectSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid content changes', async () => {
      const { container } = render(<SpaceSavingDiv />)
      const div = container.firstChild

      act(() => {
        div.textContent = 'A'
        div.textContent = ''
        div.textContent = 'B'
        div.textContent = ''
        div.textContent = 'C'
      })

      await waitFor(() => {
        expect(div).not.toHaveClass('hidden')
      })
    })

    it('should preserve custom className when showing/hiding', async () => {
      const { container } = render(
        <SpaceSavingDiv className="custom-class" defaultHasContent={true}>
          Content
        </SpaceSavingDiv>
      )
      const div = container.firstChild

      expect(div).toHaveClass('custom-class')
      expect(div).not.toHaveClass('hidden')

      act(() => {
        div.textContent = ''
      })

      await waitFor(() => {
        expect(div).toHaveClass('custom-class')
        expect(div).toHaveClass('hidden')
      })
    })

    it('should handle content added after render', async () => {
      const { container } = render(<SpaceSavingDiv />)
      const div = container.firstChild

      expect(div).toHaveClass('hidden')

      act(() => {
        div.textContent = 'Added content'
      })

      await waitFor(() => {
        expect(div).not.toHaveClass('hidden')
      })
    })
  })
})
