import useFunctionPacks from './useFunctionPacks'

import { renderHook } from '@testing-library/react'

describe('useFunctionPacks', () => {
  const createMockPack = (
    id,
    description,
    functions = {},
    isDefault = false
  ) => ({
    id,
    description,
    functions,
    default: isDefault,
  })

  describe('initialization', () => {
    it('should load ALL packs by default (not just default packs)', () => {
      const packs = [
        createMockPack('pack1', 'Pack 1', {}, true),
        createMockPack('pack2', 'Pack 2', {}, false),
        createMockPack('pack3', 'Pack 3', {}, true),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Should NOT have pack management functions (they are disabled)
      expect(result.current.listAvailableFunctionPacks).toBeUndefined()
      expect(result.current.listLoadedFunctionPacks).toBeUndefined()
      expect(result.current.loadFunctionPack).toBeUndefined()
    })

    it('should initialize with empty packs array', () => {
      const { result } = renderHook(() => useFunctionPacks([]))

      // Should return empty object
      expect(Object.keys(result.current)).toHaveLength(0)
    })
  })

  // @todo re-enable these tests when pack management functions are restored
  // describe('standard functions', () => {
  //   describe('listAvailableFunctionPacks', () => { ... })
  //   describe('listLoadedFunctionPacks', () => { ... })
  //   describe('loadFunctionPack', () => { ... })
  // })

  describe('function pack merging', () => {
    it('should merge functions from all packs', () => {
      const packs = [
        createMockPack(
          'pack1',
          'Pack 1',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
            func2: { description: 'Function 2', handler: () => 'result2' },
          },
          true
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      expect(result.current.func1).toBeDefined()
      expect(result.current.func2).toBeDefined()
      expect(result.current.func1.handler()).toBe('result1')
      expect(result.current.func2.handler()).toBe('result2')
    })

    it('should merge functions from multiple packs', () => {
      const packs = [
        createMockPack(
          'pack1',
          'Pack 1',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
          },
          true
        ),
        createMockPack(
          'pack2',
          'Pack 2',
          {
            func2: { description: 'Function 2', handler: () => 'result2' },
          },
          false // even non-default packs should be loaded
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Both functions should be available (all packs loaded)
      expect(result.current.func1).toBeDefined()
      expect(result.current.func2).toBeDefined()
    })

    it('should handle packs with no functions', () => {
      const packs = [createMockPack('pack1', 'Pack 1', null, true)]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Should return empty object (no pack management functions either)
      expect(Object.keys(result.current)).toHaveLength(0)
    })

    it('should handle packs with undefined functions', () => {
      const packs = [createMockPack('pack1', 'Pack 1', undefined, true)]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Should return empty object
      expect(Object.keys(result.current)).toHaveLength(0)
    })

    it('should load ALL packs upfront including non-default', () => {
      const packs = [
        createMockPack(
          'pack1',
          'Pack 1',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
          },
          true // default
        ),
        createMockPack(
          'pack2',
          'Pack 2',
          {
            func2: { description: 'Function 2', handler: () => 'result2' },
          },
          false // non-default - should STILL be loaded
        ),
        createMockPack(
          'pack3',
          'Pack 3',
          {
            func3: { description: 'Function 3', handler: () => 'result3' },
          },
          false // non-default - should STILL be loaded
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // ALL functions from ALL packs should be available immediately
      expect(result.current.func1).toBeDefined()
      expect(result.current.func2).toBeDefined()
      expect(result.current.func3).toBeDefined()

      // Verify all functions work
      expect(result.current.func1.handler()).toBe('result1')
      expect(result.current.func2.handler()).toBe('result2')
      expect(result.current.func3.handler()).toBe('result3')
    })
  })

  describe('edge cases', () => {
    it('should handle pack with empty ID', () => {
      const packs = [
        createMockPack(
          '',
          'Empty ID Pack',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
          },
          true
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      expect(result.current.func1).toBeDefined()
    })

    it('should handle pack with empty description', () => {
      const packs = [
        createMockPack(
          'pack1',
          '',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
          },
          true
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      expect(result.current.func1).toBeDefined()
    })

    it('should handle multiple packs with same ID', () => {
      const packs = [
        createMockPack(
          'same-id',
          'First Pack',
          {
            func1: { description: 'Function 1', handler: () => 'first' },
          },
          true
        ),
        createMockPack(
          'same-id',
          'Second Pack',
          {
            func1: { description: 'Function 1', handler: () => 'second' },
          },
          false
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Later pack should override earlier pack with same function name
      expect(result.current.func1.handler()).toBe('second')
    })

    it('should handle function name conflicts across packs', () => {
      const packs = [
        createMockPack(
          'pack1',
          'Pack 1',
          {
            sharedFunc: {
              description: 'Shared from pack1',
              handler: () => 'pack1',
            },
          },
          true
        ),
        createMockPack(
          'pack2',
          'Pack 2',
          {
            sharedFunc: {
              description: 'Shared from pack2',
              handler: () => 'pack2',
            },
          },
          true
        ),
      ]

      const { result } = renderHook(() => useFunctionPacks(packs))

      // Later pack should win
      expect(result.current.sharedFunc.handler()).toBe('pack2')
    })
  })

  describe('memoization', () => {
    it('should memoize functions object', () => {
      const packs = [
        createMockPack(
          'pack1',
          'Pack 1',
          {
            func1: { description: 'Function 1', handler: () => 'result1' },
          },
          true
        ),
      ]

      const { result, rerender } = renderHook(() => useFunctionPacks(packs))

      const firstRender = result.current

      rerender()

      const secondRender = result.current

      // Reference should be stable across rerenders when nothing changes
      expect(firstRender).toBe(secondRender)
    })
  })
})
