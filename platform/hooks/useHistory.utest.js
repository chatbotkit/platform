import useHistory from './useHistory'

import { act, renderHook } from '@testing-library/react'

describe('useHistory', () => {
  describe('initialization', () => {
    it('should initialize with empty history and future', () => {
      const { result } = renderHook(() => useHistory())

      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
      expect(result.current.historyLength).toBe(0)
      expect(result.current.futureLength).toBe(0)
    })

    it('should accept custom maxHistoryLength', () => {
      const { result } = renderHook(() => useHistory({ maxHistoryLength: 10 }))

      // Push 15 states, only 10 should be kept
      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.pushState({ value: i })
        }
      })

      expect(result.current.historyLength).toBe(10)
    })
  })

  describe('pushState', () => {
    it('should add state to history', () => {
      const { result } = renderHook(() => useHistory())

      act(() => {
        result.current.pushState({ nodes: [], edges: [] })
      })

      expect(result.current.canUndo).toBe(true)
      expect(result.current.historyLength).toBe(1)
    })

    it('should clear future when pushing new state', () => {
      const { result } = renderHook(() => useHistory())

      // Push two states
      act(() => {
        result.current.pushState({ value: 1 })
        result.current.pushState({ value: 2 })
      })

      // Undo once to create future
      act(() => {
        result.current.pushToFuture({ value: 3 })
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)

      // Push new state should clear future
      act(() => {
        result.current.pushState({ value: 4 })
      })

      expect(result.current.canRedo).toBe(false)
    })

    it('should limit history to maxHistoryLength', () => {
      const { result } = renderHook(() => useHistory({ maxHistoryLength: 3 }))

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.pushState({ value: i })
        }
      })

      expect(result.current.historyLength).toBe(3)
    })
  })

  describe('undo', () => {
    it('should return null when no history', () => {
      const { result } = renderHook(() => useHistory())

      let undoneState

      act(() => {
        undoneState = result.current.undo()
      })

      expect(undoneState).toBeNull()
    })

    it('should return the last pushed state', () => {
      const { result } = renderHook(() => useHistory())

      const state1 = { nodes: [{ id: 'a' }], edges: [] }
      const state2 = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] }

      act(() => {
        result.current.pushState(state1)
        result.current.pushState(state2)
      })

      let undoneState

      act(() => {
        undoneState = result.current.undo()
      })

      expect(undoneState).toEqual(state2)
    })

    it('should update canUndo after undo', () => {
      const { result } = renderHook(() => useHistory())

      act(() => {
        result.current.pushState({ value: 1 })
      })

      expect(result.current.canUndo).toBe(true)

      act(() => {
        result.current.undo()
      })

      expect(result.current.canUndo).toBe(false)
    })
  })

  describe('redo', () => {
    it('should return null when no future', () => {
      const { result } = renderHook(() => useHistory())

      let redoneState

      act(() => {
        redoneState = result.current.redo()
      })

      expect(redoneState).toBeNull()
    })

    it('should return the undone state', () => {
      const { result } = renderHook(() => useHistory())

      const state1 = { nodes: [{ id: 'a' }], edges: [] }

      act(() => {
        result.current.pushState(state1)
        result.current.pushToFuture(state1)
        result.current.undo()
      })

      let redoneState

      act(() => {
        redoneState = result.current.redo()
      })

      expect(redoneState).toEqual(state1)
    })

    it('should update canRedo after redo', () => {
      const { result } = renderHook(() => useHistory())

      act(() => {
        result.current.pushState({ value: 1 })
        result.current.pushToFuture({ value: 2 })
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.redo()
      })

      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('pushToFuture', () => {
    it('should add state to future for redo when used with undo', () => {
      const { result } = renderHook(() => useHistory())

      // @note pushToFuture is intended to be used together with undo,
      // so we test it in that context
      act(() => {
        result.current.pushState({ value: 1 })
        result.current.pushToFuture({ value: 2 })
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)
      expect(result.current.futureLength).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear both history and future', () => {
      const { result } = renderHook(() => useHistory())

      act(() => {
        result.current.pushState({ value: 1 })
        result.current.pushToFuture({ value: 2 })
      })

      expect(result.current.canUndo).toBe(true)
      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.clear()
      })

      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
      expect(result.current.historyLength).toBe(0)
      expect(result.current.futureLength).toBe(0)
    })
  })

  describe('integration workflow', () => {
    it('should support typical undo/redo workflow', () => {
      const { result } = renderHook(() => useHistory())

      const state1 = { nodes: [{ id: '1' }], edges: [] }
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] }
      const state3 = {
        nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
        edges: [],
      }

      // Push three states
      act(() => {
        result.current.pushState(state1)
        result.current.pushState(state2)
        result.current.pushState(state3)
      })

      expect(result.current.historyLength).toBe(3)
      expect(result.current.canUndo).toBe(true)
      expect(result.current.canRedo).toBe(false)

      // Undo twice
      let undoneState

      act(() => {
        result.current.pushToFuture({
          nodes: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
          edges: [],
        })
        undoneState = result.current.undo()
      })
      expect(undoneState).toEqual(state3)

      act(() => {
        result.current.pushToFuture({
          nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
          edges: [],
        })
        undoneState = result.current.undo()
      })
      expect(undoneState).toEqual(state2)

      expect(result.current.historyLength).toBe(1)
      expect(result.current.futureLength).toBe(2)
      expect(result.current.canRedo).toBe(true)

      // Redo once
      let redoneState

      act(() => {
        redoneState = result.current.redo()
      })
      expect(redoneState).toEqual({
        nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
        edges: [],
      })

      expect(result.current.futureLength).toBe(1)
    })
  })
})
