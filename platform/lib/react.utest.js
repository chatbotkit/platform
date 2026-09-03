import { forwardRef, memo } from 'react'

import {
  isComponent,
  isForwardRefComponent,
  isFunctionComponent,
  isMemoComponent,
} from '@/lib/react'

describe('react type guards', () => {
  describe('isFunctionComponent', () => {
    it('should return true for function components', () => {
      const FunctionComponent = () => <div>test</div>

      expect(isFunctionComponent(FunctionComponent)).toBe(true)
    })

    it('should return true for arrow function components', () => {
      const ArrowComponent = () => <div>test</div>

      expect(isFunctionComponent(ArrowComponent)).toBe(true)
    })

    it('should return true for class components', () => {
      class ClassComponent extends Object {
        render() {
          return <div>test</div>
        }
      }

      expect(isFunctionComponent(ClassComponent)).toBe(true)
    })

    it('should return false for non-function values', () => {
      expect(isFunctionComponent(null)).toBe(false)
      expect(isFunctionComponent(undefined)).toBe(false)
      expect(isFunctionComponent({})).toBe(false)
      expect(isFunctionComponent('string')).toBe(false)
      expect(isFunctionComponent(123)).toBe(false)
      expect(isFunctionComponent([])).toBe(false)
    })
  })

  describe('isMemoComponent', () => {
    it('should return true for memo components', () => {
      const Component = () => <div>test</div>
      const MemoComponent = memo(Component)

      expect(isMemoComponent(MemoComponent)).toBe(true)
    })

    it('should return false for regular function components', () => {
      const FunctionComponent = () => <div>test</div>

      expect(isMemoComponent(FunctionComponent)).toBe(false)
    })

    it('should return false for non-memo values', () => {
      expect(isMemoComponent(null)).toBe(false)
      expect(isMemoComponent(undefined)).toBe(false)
      expect(isMemoComponent({})).toBe(false)
      expect(isMemoComponent('string')).toBe(false)
      expect(isMemoComponent(123)).toBe(false)
    })

    it('should return false for objects without $$typeof', () => {
      expect(isMemoComponent({ type: 'div' })).toBe(false)
    })
  })

  describe('isForwardRefComponent', () => {
    it('should return true for forwardRef components', () => {
      const Component = forwardRef(function ForwardRefComponent(props, ref) {
        return <div ref={ref}>test</div>
      })

      expect(isForwardRefComponent(Component)).toBe(true)
    })

    it('should return false for regular function components', () => {
      const FunctionComponent = () => <div>test</div>

      expect(isForwardRefComponent(FunctionComponent)).toBe(false)
    })

    it('should return false for memo components', () => {
      const Component = () => <div>test</div>
      const MemoComponent = memo(Component)

      expect(isForwardRefComponent(MemoComponent)).toBe(false)
    })

    it('should return false for non-forwardRef values', () => {
      expect(isForwardRefComponent(null)).toBe(false)
      expect(isForwardRefComponent(undefined)).toBe(false)
      expect(isForwardRefComponent({})).toBe(false)
      expect(isForwardRefComponent('string')).toBe(false)
      expect(isForwardRefComponent(123)).toBe(false)
    })
  })

  describe('isComponent', () => {
    it('should return true for function components', () => {
      function FunctionComponent() {
        return <div>test</div>
      }

      expect(isComponent(FunctionComponent)).toBe(true)
    })

    it('should return true for memo components', () => {
      function Component() {
        return <div>test</div>
      }

      const MemoComponent = memo(Component)

      expect(isComponent(MemoComponent)).toBe(true)
    })

    it('should return true for forwardRef components', () => {
      const Component = forwardRef(function ForwardRefComponent(props, ref) {
        return <div ref={ref}>test</div>
      })

      expect(isComponent(Component)).toBe(true)
    })

    it('should return true for memo + forwardRef components', () => {
      const Component = forwardRef(function ForwardRefComponent(props, ref) {
        return <div ref={ref}>test</div>
      })
      const MemoForwardRefComponent = memo(Component)

      expect(isComponent(MemoForwardRefComponent)).toBe(true)
    })

    it('should return false for non-component values', () => {
      expect(isComponent(null)).toBe(false)
      expect(isComponent(undefined)).toBe(false)
      expect(isComponent({})).toBe(false)
      expect(isComponent('string')).toBe(false)
      expect(isComponent(123)).toBe(false)
      expect(isComponent([])).toBe(false)
    })

    it('should return false for plain objects', () => {
      expect(isComponent({ type: 'div', props: {} })).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle components with display names', () => {
      function Component() {
        return <div>test</div>
      }

      Component.displayName = 'TestComponent'

      expect(isFunctionComponent(Component)).toBe(true)
      expect(isComponent(Component)).toBe(true)
    })

    it('should handle nested memo and forwardRef', () => {
      const Component = forwardRef(function ForwardRefComponent(props, ref) {
        return <div ref={ref}>test</div>
      })
      const MemoComponent = memo(Component)

      expect(isComponent(MemoComponent)).toBe(true)
      expect(isMemoComponent(MemoComponent)).toBe(true)
    })

    it('should handle arrow functions with explicit return', () => {
      function Component() {
        return <div>test</div>
      }

      expect(isFunctionComponent(Component)).toBe(true)
      expect(isComponent(Component)).toBe(true)
    })
  })
})
