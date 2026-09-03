import useClassNameOnNewElements from './useClassNameOnNewElements'

import { act, renderHook, waitFor } from '@testing-library/react'

describe('useClassNameOnNewElements', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return a callback ref function', () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      expect(typeof result.current).toBe('function')
    })
  })

  describe('class name application', () => {
    it('should add class name to new elements', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      // Wait for MutationObserver callback
      await waitFor(() => {
        const newElement = container.querySelector('div')

        expect(newElement.classList.contains('test-class')).toBe(true)
      })
    })

    it('should add multiple class names separated by spaces', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'class-one class-two class-three',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      await waitFor(() => {
        const newElement = container.querySelector('div')

        expect(newElement.classList.contains('class-one')).toBe(true)
        expect(newElement.classList.contains('class-two')).toBe(true)
        expect(newElement.classList.contains('class-three')).toBe(true)
      })
    })

    it('should handle className with extra whitespace', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: '  class-one   class-two  ',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      await waitFor(() => {
        const newElement = container.querySelector('div')

        expect(newElement.classList.contains('class-one')).toBe(true)
        expect(newElement.classList.contains('class-two')).toBe(true)
      })
    })
  })

  describe('type filtering', () => {
    it('should only add classes to included element types', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          includeTypes: ['div', 'span'],
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const divElement = document.createElement('div')
        const spanElement = document.createElement('span')
        const pElement = document.createElement('p')

        container.appendChild(divElement)
        container.appendChild(spanElement)
        container.appendChild(pElement)
      })

      await waitFor(() => {
        const divElement = container.querySelector('div')
        const spanElement = container.querySelector('span')
        const pElement = container.querySelector('p')

        expect(divElement.classList.contains('test-class')).toBe(true)
        expect(spanElement.classList.contains('test-class')).toBe(true)
        expect(pElement.classList.contains('test-class')).toBe(false)
      })
    })

    it('should not add classes to excluded element types', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          excludeTypes: ['p', 'button'],
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const divElement = document.createElement('div')
        const pElement = document.createElement('p')
        const buttonElement = document.createElement('button')

        container.appendChild(divElement)
        container.appendChild(pElement)
        container.appendChild(buttonElement)
      })

      await waitFor(() => {
        const divElement = container.querySelector('div')
        const pElement = container.querySelector('p')
        const buttonElement = container.querySelector('button')

        expect(divElement.classList.contains('test-class')).toBe(true)
        expect(pElement.classList.contains('test-class')).toBe(false)
        expect(buttonElement.classList.contains('test-class')).toBe(false)
      })
    })

    it('should handle empty includeTypes array', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          includeTypes: [],
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const divElement = document.createElement('div')

        container.appendChild(divElement)
      })

      await waitFor(() => {
        const divElement = container.querySelector('div')

        expect(divElement.classList.contains('test-class')).toBe(true)
      })
    })

    it('should handle empty excludeTypes array', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          excludeTypes: [],
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const divElement = document.createElement('div')

        container.appendChild(divElement)
      })

      await waitFor(() => {
        const divElement = container.querySelector('div')

        expect(divElement.classList.contains('test-class')).toBe(true)
      })
    })
  })

  describe('skip class functionality', () => {
    it('should not add classes to elements with skip-new-element-observer class', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const skippedElement = document.createElement('div')

        skippedElement.classList.add('skip-new-element-observer')

        const normalElement = document.createElement('div')

        container.appendChild(skippedElement)
        container.appendChild(normalElement)
      })

      await waitFor(() => {
        const elements = container.querySelectorAll('div')
        const skippedElement = elements[0]
        const normalElement = elements[1]

        expect(skippedElement.classList.contains('test-class')).toBe(false)
        expect(normalElement.classList.contains('test-class')).toBe(true)
      })
    })
  })

  describe('disabled state', () => {
    it('should not observe when disabled is true', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
          disabled: true,
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      const newElement = container.querySelector('div')

      expect(newElement.classList.contains('test-class')).toBe(false)
    })

    it('should start observing when disabled changes to false', async () => {
      const { result, rerender } = renderHook(
        ({ disabled }) =>
          useClassNameOnNewElements({
            className: 'test-class',
            disabled,
          }),
        {
          initialProps: { disabled: true },
        }
      )

      act(() => {
        result.current(container)
      })

      // Rerender with disabled = false
      rerender({ disabled: false })

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      await waitFor(() => {
        const newElement = container.querySelector('div')

        expect(newElement.classList.contains('test-class')).toBe(true)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle null ref', () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      // Calling callback ref with null should not error
      expect(() => {
        act(() => {
          result.current(null)
        })
      }).not.toThrow()
    })

    it('should handle text nodes (non-element nodes)', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      act(() => {
        const textNode = document.createTextNode('text')

        container.appendChild(textNode)
      })

      await new Promise((resolve) => setTimeout(resolve, 20))
      // Should not throw error, text nodes are ignored
    })

    it('should not add classes to same element twice', async () => {
      const { result } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      const newElement = document.createElement('div')

      act(() => {
        container.appendChild(newElement)
      })

      await waitFor(() => {
        expect(newElement.classList.contains('test-class')).toBe(true)
      })

      // Remove and re-add same element
      act(() => {
        container.removeChild(newElement)
        container.appendChild(newElement)
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      // Class should not be added again (tracked by WeakSet)
      const classCount = Array.from(newElement.classList).filter(
        (c) => c === 'test-class'
      ).length

      expect(classCount).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should disconnect observer on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useClassNameOnNewElements({
          className: 'test-class',
        })
      )

      act(() => {
        result.current(container)
      })

      unmount()

      act(() => {
        const newElement = document.createElement('div')

        container.appendChild(newElement)
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      const newElement = container.querySelector('div')

      // Class should not be added after unmount
      expect(newElement.classList.contains('test-class')).toBe(false)
    })
  })
})
