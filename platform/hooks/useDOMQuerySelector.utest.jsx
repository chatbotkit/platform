import useDOMQuerySelector from './useDOMQuerySelector'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/useDeps', () => ({
  __esModule: true,
  default: jest.fn((deps) => deps),
}))

describe('useDOMQuerySelector', () => {
  let container

  beforeEach(() => {
    jest.clearAllMocks()

    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('basic functionality', () => {
    it('should return empty array when no selector provided', () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector(null, { parent: container })
      )

      expect(result.current).toEqual([])
    })

    it('should return elements matching selector', () => {
      container.innerHTML = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
      `

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', { parent: container })
      )

      expect(result.current).toHaveLength(3)
      expect(result.current[0].textContent).toBe('Item 1')
      expect(result.current[1].textContent).toBe('Item 2')
      expect(result.current[2].textContent).toBe('Item 3')
    })

    it('should return empty array when no elements match', () => {
      container.innerHTML = `<div class="other">Other</div>`

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', { parent: container })
      )

      expect(result.current).toEqual([])
    })

    it('should use document.documentElement as default parent', () => {
      const testDiv = document.createElement('div')

      testDiv.className = 'test-item'
      testDiv.textContent = 'Test'
      document.body.appendChild(testDiv)

      const { result } = renderHook(() => useDOMQuerySelector('.test-item'))

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Test')

      document.body.removeChild(testDiv)
    })

    it('should return empty array when parent is not available', () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', { parent: null })
      )

      expect(result.current).toEqual([])
    })
  })

  describe('waitForElements option', () => {
    it('should wait for elements when waitForElements is true', async () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
        })
      )

      expect(result.current).toEqual([])

      act(() => {
        const item = document.createElement('div')

        item.className = 'item'
        item.textContent = 'New Item'
        container.appendChild(item)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('New Item')
    })

    it('should not wait when elements already exist', () => {
      container.innerHTML = `<div class="item">Existing</div>`

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
        })
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Existing')
    })

    it('should observe multiple elements being added', async () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
          disconnectOnFirstMatch: false,
        })
      )

      expect(result.current).toEqual([])

      act(() => {
        const item1 = document.createElement('div')

        item1.className = 'item'
        container.appendChild(item1)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(1)

      act(() => {
        const item2 = document.createElement('div')

        item2.className = 'item'
        container.appendChild(item2)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(2)
    })
  })

  describe('disconnectOnFirstMatch option', () => {
    it('should disconnect observer after first match by default', async () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
        })
      )

      expect(result.current).toEqual([])

      act(() => {
        const item1 = document.createElement('div')

        item1.className = 'item'
        container.appendChild(item1)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(1)

      const firstResultLength = result.current.length

      act(() => {
        const item2 = document.createElement('div')

        item2.className = 'item'
        container.appendChild(item2)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(firstResultLength)
    })

    it('should continue observing when disconnectOnFirstMatch is false', async () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
          disconnectOnFirstMatch: false,
        })
      )

      act(() => {
        const item1 = document.createElement('div')

        item1.className = 'item'
        container.appendChild(item1)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(1)

      act(() => {
        const item2 = document.createElement('div')

        item2.className = 'item'
        container.appendChild(item2)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(result.current).toHaveLength(2)
    })
  })

  describe('dependency updates', () => {
    it('should update results when selector changes', () => {
      container.innerHTML = `
        <div class="item">Item</div>
        <div class="other">Other</div>
      `

      const { result, rerender } = renderHook(
        ({ selector }) => useDOMQuerySelector(selector, { parent: container }),
        { initialProps: { selector: '.item' } }
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Item')

      rerender({ selector: '.other' })

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Other')
    })

    it('should update results when deps change', () => {
      container.innerHTML = `<div class="item">Item 1</div>`

      const { result, rerender } = renderHook(
        ({ deps }) => useDOMQuerySelector('.item', { parent: container }, deps),
        { initialProps: { deps: [1] } }
      )

      expect(result.current).toHaveLength(1)

      act(() => {
        const item2 = document.createElement('div')

        item2.className = 'item'
        item2.textContent = 'Item 2'
        container.appendChild(item2)
      })

      rerender({ deps: [2] })

      expect(result.current).toHaveLength(2)
    })

    it('should update results when parent changes', () => {
      const container1 = document.createElement('div')

      container1.innerHTML = `<div class="item">Container 1</div>`
      document.body.appendChild(container1)

      const container2 = document.createElement('div')

      container2.innerHTML = `<div class="item">Container 2</div>`
      document.body.appendChild(container2)

      const { result, rerender } = renderHook(
        ({ parent }) => useDOMQuerySelector('.item', { parent }),
        { initialProps: { parent: container1 } }
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Container 1')

      rerender({ parent: container2 })

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Container 2')

      document.body.removeChild(container1)
      document.body.removeChild(container2)
    })
  })

  describe('cleanup', () => {
    it('should disconnect observer on unmount', async () => {
      const { unmount } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
        })
      )

      unmount()

      act(() => {
        const item = document.createElement('div')

        item.className = 'item'
        container.appendChild(item)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(container.querySelectorAll('.item')).toHaveLength(1)
    })

    it('should handle observer disconnect errors gracefully', () => {
      const { unmount } = renderHook(() =>
        useDOMQuerySelector('.item', {
          parent: container,
          waitForElements: true,
        })
      )

      expect(() => {
        unmount()
      }).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle nested elements', () => {
      container.innerHTML = `
        <div class="outer">
          <div class="item">Nested 1</div>
          <div class="wrapper">
            <div class="item">Nested 2</div>
          </div>
        </div>
      `

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', { parent: container })
      )

      expect(result.current).toHaveLength(2)
    })

    it('should handle complex selectors', () => {
      container.innerHTML = `
        <div class="item" data-test="true">Item 1</div>
        <div class="item">Item 2</div>
      `

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item[data-test="true"]', { parent: container })
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].textContent).toBe('Item 1')
    })

    it('should handle undefined options', () => {
      container.innerHTML = `<div class="item">Item</div>`

      const { result } = renderHook(() =>
        useDOMQuerySelector('.item', undefined)
      )

      expect(result.current).toHaveLength(1)
    })
  })
})
