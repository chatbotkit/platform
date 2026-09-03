/* eslint-disable no-console */
import useTraceUpdate from './useTraceUpdate'

import { renderHook } from '@testing-library/react'

describe('useTraceUpdate', () => {
  const originalEnv = process.env.NODE_ENV
  const originalWarn = console.warn

  beforeEach(() => {
    console.warn = jest.fn()
  })

  afterEach(() => {
    console.warn = originalWarn
    process.env.NODE_ENV = originalEnv
  })

  describe('development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })

    it('should not warn on initial render', () => {
      renderHook(() => useTraceUpdate({ prop1: 'value1' }))

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should warn when a prop changes', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value1' } },
      })

      rerender({ props: { prop1: 'value2' } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: ['value1', 'value2'],
        })
      )
    })

    it('should warn when multiple props change', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value1', prop2: 'value2' } },
      })

      rerender({ props: { prop1: 'changed1', prop2: 'changed2' } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props'),
        expect.objectContaining({
          prop1: ['value1', 'changed1'],
          prop2: ['value2', 'changed2'],
        })
      )
    })

    it('should not warn when props have not changed', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value1' } },
      })

      rerender({ props: { prop1: 'value1' } })

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should include component id in warning message when provided', () => {
      const { rerender } = renderHook(
        ({ props, id }) => useTraceUpdate(props, id),
        {
          initialProps: { props: { prop1: 'value1' }, id: 'TestComponent' },
        }
      )

      rerender({ props: { prop1: 'value2' }, id: 'TestComponent' })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('(TestComponent)'),
        expect.any(Object)
      )
    })

    it('should detect changes from undefined to defined', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: undefined } },
      })

      rerender({ props: { prop1: 'value' } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [undefined, 'value'],
        })
      )
    })

    it('should detect changes from defined to undefined', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value' } },
      })

      rerender({ props: { prop1: undefined } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: ['value', undefined],
        })
      )
    })

    it('should detect changes from null to non-null', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: null } },
      })

      rerender({ props: { prop1: 'value' } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [null, 'value'],
        })
      )
    })

    it('should handle empty props object', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: {} },
      })

      rerender({ props: {} })

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should handle object reference changes with same values', () => {
      const obj1 = { nested: 'value' }
      const obj2 = { nested: 'value' }

      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: obj1 } },
      })

      rerender({ props: { prop1: obj2 } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [obj1, obj2],
        })
      )
    })

    it('should handle array reference changes', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]

      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: arr1 } },
      })

      rerender({ props: { prop1: arr2 } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [arr1, arr2],
        })
      )
    })

    it('should handle boolean changes', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: false } },
      })

      rerender({ props: { prop1: true } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [false, true],
        })
      )
    })

    it('should handle number changes', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 0 } },
      })

      rerender({ props: { prop1: 1 } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [0, 1],
        })
      )
    })

    it('should detect change from 0 to false', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 0 } },
      })

      rerender({ props: { prop1: false } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [0, false],
        })
      )
    })

    it('should detect change from empty string to undefined', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: '' } },
      })

      rerender({ props: { prop1: undefined } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: ['', undefined],
        })
      )
    })
  })

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('should not warn in production mode', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value1' } },
      })

      rerender({ props: { prop1: 'value2' } })

      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should not execute tracking logic in production', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: 'value1', prop2: 'value2' } },
      })

      rerender({
        props: { prop1: 'changed1', prop2: 'changed2', prop3: 'new' },
      })

      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })

    it('should handle props with special characters in keys', () => {
      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { 'prop-with-dash': 'value1' } },
      })

      rerender({ props: { 'prop-with-dash': 'value2' } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop-with-dash)'),
        expect.objectContaining({
          'prop-with-dash': ['value1', 'value2'],
        })
      )
    })

    it('should handle function props', () => {
      const fn1 = () => {}

      const fn2 = () => {}

      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { callback: fn1 } },
      })

      rerender({ props: { callback: fn2 } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (callback)'),
        expect.objectContaining({
          callback: [fn1, fn2],
        })
      )
    })

    it('should handle Symbol values', () => {
      const sym1 = Symbol('test')
      const sym2 = Symbol('test')

      const { rerender } = renderHook(({ props }) => useTraceUpdate(props), {
        initialProps: { props: { prop1: sym1 } },
      })

      rerender({ props: { prop1: sym2 } })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('changed props (prop1)'),
        expect.objectContaining({
          prop1: [sym1, sym2],
        })
      )
    })
  })
})
