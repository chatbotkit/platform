import useHasChildren from '@/hooks/useHasChildren'

import { renderHook } from '@testing-library/react'

describe('useHasChildren', () => {
  describe('single children', () => {
    it('should return true for single child element', () => {
      const children = <div>Child</div>

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for single text node', () => {
      const children = 'Text content'

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for single number', () => {
      const children = 42

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for single zero', () => {
      const children = 0

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for single component', () => {
      const MyComponent = () => <div>Component</div>
      const children = <MyComponent />

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for single fragment with content', () => {
      const children = (
        <>
          <div>Child 1</div>
        </>
      )

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })
  })

  describe('multiple children', () => {
    it('should return true for multiple child elements', () => {
      const children = [<div key="1">Child 1</div>, <div key="2">Child 2</div>]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for multiple text nodes', () => {
      const children = ['Text 1', 'Text 2', 'Text 3']

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for mixed children types', () => {
      const children = [<div key="1">Element</div>, 'Text', 42]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for fragment with multiple children', () => {
      const children = (
        <>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </>
      )

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for nested children', () => {
      const children = (
        <div>
          <span>Nested 1</span>
          <span>Nested 2</span>
        </div>
      )

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })
  })

  describe('no children', () => {
    it('should return false for null', () => {
      const children = null

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for undefined', () => {
      const children = undefined

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for empty array', () => {
      const children = []

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for empty string', () => {
      const children = ''

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false when no children provided', () => {
      const { result } = renderHook(() => useHasChildren())

      expect(result.current).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should return false for boolean true', () => {
      const children = true

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for boolean false', () => {
      const children = false

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return true for array with single element', () => {
      const children = [<div key="1">Single in array</div>]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return false for array with null values', () => {
      const children = [null, null, null]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for array with undefined values', () => {
      const children = [undefined, undefined]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return false for array with boolean values', () => {
      const children = [true, false, true]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return true for array with mix of valid and invalid children', () => {
      const children = [null, <div key="1">Valid</div>, false, undefined]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should handle conditional rendering with && operator', () => {
      const condition = true
      const children = condition && <div>Conditional child</div>

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return false for conditional rendering when false', () => {
      const condition = false
      const children = condition && <div>Conditional child</div>

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should handle ternary operator with element', () => {
      const condition = true
      const children = condition ? <div>True branch</div> : null

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return false for ternary with null result', () => {
      const condition = false
      const children = condition ? <div>True branch</div> : null

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })

    it('should return true for deeply nested elements', () => {
      const children = (
        <div>
          <div>
            <div>
              <div>
                <span>Deeply nested</span>
              </div>
            </div>
          </div>
        </div>
      )

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for portal elements', () => {
      const children = <div>Portal content</div>

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for array with whitespace strings', () => {
      const children = [' ', '\n', '\t']

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for negative numbers', () => {
      const children = -1

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should return true for float numbers', () => {
      const children = 3.14

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })
  })

  describe('memoization', () => {
    it('should return same value for same children reference', () => {
      const children = <div>Child</div>

      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: children },
        }
      )

      const firstResult = result.current

      rerender({ childrenProp: children })

      expect(result.current).toBe(firstResult)
      expect(result.current).toBe(true)
    })

    it('should recompute when children reference changes', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: <div>Child 1</div> },
        }
      )

      expect(result.current).toBe(true)

      rerender({ childrenProp: null })

      expect(result.current).toBe(false)
    })

    it('should recompute when children content changes', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: <div>Original</div> },
        }
      )

      expect(result.current).toBe(true)

      rerender({ childrenProp: <div>Updated</div> })

      expect(result.current).toBe(true)
    })

    it('should handle transition from children to no children', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: <div>Child</div> },
        }
      )

      expect(result.current).toBe(true)

      rerender({ childrenProp: null })

      expect(result.current).toBe(false)
    })

    it('should handle transition from no children to children', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: null },
        }
      )

      expect(result.current).toBe(false)

      rerender({ childrenProp: <div>Child</div> })

      expect(result.current).toBe(true)
    })

    it('should handle array children updates', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: {
            childrenProp: [<div key="1">Child 1</div>],
          },
        }
      )

      expect(result.current).toBe(true)

      rerender({
        childrenProp: [<div key="1">Child 1</div>, <div key="2">Child 2</div>],
      })

      expect(result.current).toBe(true)
    })

    it('should handle empty array to populated array', () => {
      const { result, rerender } = renderHook(
        ({ childrenProp }) => useHasChildren(childrenProp),
        {
          initialProps: { childrenProp: [] },
        }
      )

      expect(result.current).toBe(false)

      rerender({
        childrenProp: [<div key="1">Child</div>],
      })

      expect(result.current).toBe(true)
    })
  })

  describe('React.Children edge cases', () => {
    it('should use React.Children.count for counting', () => {
      const children = [
        <div key="1">Child 1</div>,
        null,
        <div key="2">Child 2</div>,
      ]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should handle children with keys', () => {
      const children = [
        <div key="unique-key-1">Child 1</div>,
        <div key="unique-key-2">Child 2</div>,
      ]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should handle children without keys in array', () => {
      const children = [<div key={1}>Child 1</div>, <div key={2}>Child 2</div>]

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should handle functional components as children', () => {
      const FunctionChild = () => <div>Function component child</div>

      const children = <FunctionChild />

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })
  })

  describe('performance characteristics', () => {
    it('should efficiently handle large arrays of children', () => {
      const children = Array.from({ length: 1000 }, (_, i) => (
        <div key={i}>Child {i}</div>
      ))

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(true)
    })

    it('should efficiently handle empty large arrays', () => {
      const children = Array.from({ length: 1000 }, () => null)

      const { result } = renderHook(() => useHasChildren(children))

      expect(result.current).toBe(false)
    })
  })
})
