import React, { forwardRef, memo } from 'react'

import {
  isComponent,
  isForwardRefComponent,
  isFunctionComponent,
  isMemoComponent,
} from '@/lib/react'

describe('react utility functions', () => {
  describe('isFunctionComponent', () => {
    it('should return true for function components', () => {
      const FunctionComponent = () => <div>Hello</div>

      expect(isFunctionComponent(FunctionComponent)).toBe(true)
    })

    it('should return true for arrow function components', () => {
      const ArrowComponent = () => <div>Hello</div>

      expect(isFunctionComponent(ArrowComponent)).toBe(true)
    })

    it('should return true for class components', () => {
      class ClassComponent extends React.Component {
        render() {
          return <div>Hello</div>
        }
      }

      expect(isFunctionComponent(ClassComponent)).toBe(true)
    })

    it('should return false for non-function values', () => {
      expect(isFunctionComponent(null)).toBe(false)
      expect(isFunctionComponent(undefined)).toBe(false)
      expect(isFunctionComponent(123)).toBe(false)
      expect(isFunctionComponent('string')).toBe(false)
      expect(isFunctionComponent({})).toBe(false)
      expect(isFunctionComponent([])).toBe(false)
    })

    it('should return false for React elements', () => {
      const element = <div>Hello</div>

      expect(isFunctionComponent(element)).toBe(false)
    })
  })

  describe('isMemoComponent', () => {
    it('should return true for memo components', () => {
      const Component = () => <div>Hello</div>
      const MemoComponent = memo(Component)

      expect(isMemoComponent(MemoComponent)).toBe(true)
    })

    it('should return true for memo components with display name', () => {
      const Component = () => <div>Hello</div>

      Component.displayName = 'MyComponent'

      const MemoComponent = memo(Component)

      expect(isMemoComponent(MemoComponent)).toBe(true)
    })

    it('should return false for regular function components', () => {
      const Component = () => <div>Hello</div>

      expect(isMemoComponent(Component)).toBe(false)
    })

    it('should return false for non-memo values', () => {
      expect(isMemoComponent(null)).toBe(false)
      expect(isMemoComponent(undefined)).toBe(false)
      expect(isMemoComponent(123)).toBe(false)
      expect(isMemoComponent('string')).toBe(false)
      expect(isMemoComponent({})).toBe(false)
      expect(isMemoComponent([])).toBe(false)
    })

    it('should return false for forwardRef components', () => {
      const Component = forwardRef((props, ref) => <div ref={ref}>Hello</div>)

      Component.displayName = 'MyForwardRefComponent'

      expect(isMemoComponent(Component)).toBe(false)
    })
  })

  describe('isForwardRefComponent', () => {
    it('should return true for forwardRef components', () => {
      const Component = forwardRef((props, ref) => <div ref={ref}>Hello</div>)

      Component.displayName = 'MyForwardRefComponent'

      expect(isForwardRefComponent(Component)).toBe(true)
    })

    it('should return true for forwardRef components with display name', () => {
      const Component = forwardRef((props, ref) => <div ref={ref}>Hello</div>)

      Component.displayName = 'MyForwardRefComponent'

      expect(isForwardRefComponent(Component)).toBe(true)
    })

    it('should return false for regular function components', () => {
      const Component = () => <div>Hello</div>

      expect(isForwardRefComponent(Component)).toBe(false)
    })

    it('should return false for memo components', () => {
      const Component = () => <div>Hello</div>
      const MemoComponent = memo(Component)

      expect(isForwardRefComponent(MemoComponent)).toBe(false)
    })

    it('should return false for non-forwardRef values', () => {
      expect(isForwardRefComponent(null)).toBe(false)
      expect(isForwardRefComponent(undefined)).toBe(false)
      expect(isForwardRefComponent(123)).toBe(false)
      expect(isForwardRefComponent('string')).toBe(false)
      expect(isForwardRefComponent({})).toBe(false)
      expect(isForwardRefComponent([])).toBe(false)
    })
  })

  describe('isComponent', () => {
    it('should return true for function components', () => {
      const Component = () => <div>Hello</div>

      expect(isComponent(Component)).toBe(true)
    })

    it('should return true for class components', () => {
      class ClassComponent extends React.Component {
        render() {
          return <div>Hello</div>
        }
      }

      expect(isComponent(ClassComponent)).toBe(true)
    })

    it('should return true for memo components', () => {
      const Component = () => <div>Hello</div>
      const MemoComponent = memo(Component)

      expect(isComponent(MemoComponent)).toBe(true)
    })

    it('should return true for forwardRef components', () => {
      const Component = forwardRef((props, ref) => <div ref={ref}>Hello</div>)

      Component.displayName = 'MyForwardRefComponent'

      expect(isComponent(Component)).toBe(true)
    })

    it('should return true for memo wrapped forwardRef components', () => {
      const Component = forwardRef((props, ref) => <div ref={ref}>Hello</div>)

      Component.displayName = 'MyForwardRefComponent'

      const MemoComponent = memo(Component)

      expect(isComponent(MemoComponent)).toBe(true)
    })

    it('should return false for non-component values', () => {
      expect(isComponent(null)).toBe(false)
      expect(isComponent(undefined)).toBe(false)
      expect(isComponent(123)).toBe(false)
      expect(isComponent('string')).toBe(false)
      expect(isComponent({})).toBe(false)
      expect(isComponent([])).toBe(false)
    })

    it('should return false for React elements', () => {
      const element = <div>Hello</div>

      expect(isComponent(element)).toBe(false)
    })

    it('should return false for plain objects with $$typeof', () => {
      const fakeComponent = {
        $$typeof: {
          toString: () => 'Symbol(react.element)',
        },
      }

      expect(isComponent(fakeComponent)).toBe(false)
    })
  })

  describe('type guards work correctly', () => {
    it('should narrow type for function components', () => {
      const maybeComponent = () => <div>Hello</div>

      if (isFunctionComponent(maybeComponent)) {
        const component = maybeComponent

        expect(component).toBeDefined()
      }
    })

    it('should narrow type for memo components', () => {
      const Component = () => <div>Hello</div>
      const maybeComponent = memo(Component)

      if (isMemoComponent(maybeComponent)) {
        const component = maybeComponent

        expect(component).toBeDefined()
      }
    })

    it('should narrow type for forwardRef components', () => {
      const maybeComponent = forwardRef((props, ref) => (
        <div ref={ref}>Hello</div>
      ))

      maybeComponent.displayName = 'MyForwardRefComponent'

      if (isForwardRefComponent(maybeComponent)) {
        const component = maybeComponent

        expect(component).toBeDefined()
      }
    })
  })

  describe('edge cases', () => {
    it('should handle components with custom properties', () => {
      const Component = () => <div>Hello</div>

      Component.customProp = 'custom'

      expect(isFunctionComponent(Component)).toBe(true)
      expect(isComponent(Component)).toBe(true)
    })

    it('should handle anonymous functions', () => {
      expect(isFunctionComponent(() => <div>Hello</div>)).toBe(true)
      expect(isComponent(() => <div>Hello</div>)).toBe(true)
    })

    it('should handle async functions (not valid React components)', () => {
      const asyncFunc = async () => <div>Hello</div>

      // async functions are still functions, so type guard returns true
      // but they are not valid React components
      expect(isFunctionComponent(asyncFunc)).toBe(true)
    })

    it('should handle generator functions (not valid React components)', () => {
      const generatorFunc = function* () {
        yield <div>Hello</div>
      }

      // Generator functions are still functions
      expect(isFunctionComponent(generatorFunc)).toBe(true)
    })
  })
})
