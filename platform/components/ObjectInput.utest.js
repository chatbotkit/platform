import { useState } from 'react'

// import after mocks
import ObjectInput from './ObjectInput'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// mock heroicons - use virtual to create a non-existent module
jest.mock(
  '@heroicons/react/24/outline/esm/ArrowsPointingOutIcon',
  () => ({
    __esModule: true,
    default: () => null,
  }),
  { virtual: true }
)

// mock dependencies that cause module resolution issues
jest.mock('@/components/ZoomableArea', () => {
  return function MockZoomableArea({ children }) {
    return <div data-testid="zoomable-area">{children}</div>
  }
})

jest.mock('@/components/TextareaHighlighter', () => {
  return function MockTextareaHighlighter() {
    return null
  }
})

jest.mock('@/components/AdvancedAutoTextarea', () => {
  return function MockAdvancedAutoTextarea({
    value,
    onChange,
    children,
    ...props
  }) {
    return (
      <div>
        <textarea
          {...props}
          value={value}
          onChange={onChange}
          data-testid="object-textarea"
        />
        {children}
      </div>
    )
  }
})

// helper wrapper for controlled object state
function ControlledObjectInput({ initialObject, ...props }) {
  const [object, setObject] = useState(initialObject)

  return <ObjectInput {...props} object={object} setObject={setObject} />
}

describe('ObjectInput', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<ObjectInput />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toBeInTheDocument()
    })

    it('should render the textarea container full-width by default', () => {
      render(<ObjectInput />)

      expect(
        screen.getByTestId('object-textarea').parentElement.parentElement
      ).toHaveClass('w-full')
    })

    it('should render with defaultObject as YAML', () => {
      render(<ObjectInput defaultObject={{ key: 'value', nested: { a: 1 } }} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea.value).toContain('key: value')
    })
  })

  describe('value reformatting during editing', () => {
    it('should NOT reformat value while user is actively editing (before blur)', async () => {
      // @note this tests the critical issue where value gets reformatted during typing

      render(<ControlledObjectInput initialObject={{ foo: 'bar' }} />)

      const textarea = screen.getByTestId('object-textarea')

      // user focuses the textarea (starts editing)
      fireEvent.focus(textarea)

      // user starts typing and adds extra spaces/formatting
      const userTypedValue = 'foo:    bar\nbaz:   qux'

      fireEvent.change(textarea, { target: { value: userTypedValue } })

      // value should reflect exactly what user typed
      expect(textarea.value).toBe(userTypedValue)

      // advance past debounce timer
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // @note the value should STILL be what the user typed, not reformatted
      // because the textarea is still focused
      expect(textarea.value).toBe(userTypedValue)
    })

    it('should preserve user formatting until blur event', async () => {
      render(<ControlledObjectInput initialObject={{ key: 'value' }} />)

      const textarea = screen.getByTestId('object-textarea')

      // user focuses the textarea
      fireEvent.focus(textarea)

      // user types with intentional formatting (extra spaces, specific line breaks)
      const userFormattedYaml = 'key:   value\n\n# comment\nother:  thing'

      fireEvent.change(textarea, { target: { value: userFormattedYaml } })

      // advance timers past debounce
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // value should still match user's formatting exactly while focused
      expect(textarea.value).toBe(userFormattedYaml)
    })

    it('should allow reformatting after blur when external object changes', async () => {
      const { rerender } = render(
        <ObjectInput object={{ foo: 'bar' }} setObject={() => {}} />
      )

      const textarea = screen.getByTestId('object-textarea')

      // user focuses and types
      fireEvent.focus(textarea)
      fireEvent.change(textarea, { target: { value: 'foo:    bar' } })

      // advance past debounce
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // while focused, value stays as user typed
      expect(textarea.value).toBe('foo:    bar')

      // user blurs (finishes editing)
      fireEvent.blur(textarea)

      // now if the object changes externally, value should sync
      rerender(<ObjectInput object={{ baz: 'qux' }} setObject={() => {}} />)

      expect(textarea.value).toContain('baz: qux')
    })

    it('should parse and update object state after debounce without reformatting text', async () => {
      const setObjectMock = jest.fn()

      render(
        <ObjectInput
          defaultObject={{ initial: 'value' }}
          setObject={setObjectMock}
        />
      )

      const textarea = screen.getByTestId('object-textarea')

      // user focuses and types new value
      fireEvent.focus(textarea)
      fireEvent.change(textarea, { target: { value: 'newKey:   newValue' } })

      // before debounce, setObject should not have been called with new value
      expect(setObjectMock).not.toHaveBeenCalledWith({ newKey: 'newValue' })

      // advance past debounce
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // after debounce, setObject should be called with parsed object
      expect(setObjectMock).toHaveBeenCalledWith({ newKey: 'newValue' })

      // but the textarea value should still be exactly what user typed
      expect(textarea.value).toBe('newKey:   newValue')
    })
  })

  describe('controlled object behavior', () => {
    it('should update value when external object changes and textarea is not focused', () => {
      const { rerender } = render(
        <ObjectInput object={{ a: 1 }} setObject={() => {}} />
      )

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea.value).toContain('a: 1')

      // simulate external object update (e.g., from parent component)
      rerender(<ObjectInput object={{ b: 2 }} setObject={() => {}} />)

      // value should update to reflect new object
      expect(textarea.value).toContain('b: 2')
    })
  })

  describe('null object handling', () => {
    it('should show empty string when object is null (not "null" text)', () => {
      render(<ObjectInput object={null} setObject={() => {}} />)

      const textarea = screen.getByTestId('object-textarea')

      // @note should be empty, not "null" text which looks strange
      expect(textarea.value).toBe('')
    })

    it('should show empty string when defaultObject is null', () => {
      render(<ObjectInput defaultObject={null} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea.value).toBe('')
    })

    it('should not be disabled when object is null', () => {
      render(<ObjectInput object={null} setObject={() => {}} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).not.toBeDisabled()
    })

    it('should allow editing when object is null', () => {
      const setObjectMock = jest.fn()

      render(<ObjectInput object={null} setObject={setObjectMock} />)

      const textarea = screen.getByTestId('object-textarea')

      // user can focus and type
      fireEvent.focus(textarea)
      fireEvent.change(textarea, { target: { value: 'key: value' } })

      expect(textarea.value).toBe('key: value')

      // advance past debounce
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // should call setObject with parsed value
      expect(setObjectMock).toHaveBeenCalledWith({ key: 'value' })
    })

    it('should update from null to object value when external object changes', () => {
      const { rerender } = render(
        <ObjectInput object={null} setObject={() => {}} />
      )

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea.value).toBe('')

      // simulate external object update from null to actual object
      rerender(<ObjectInput object={{ foo: 'bar' }} setObject={() => {}} />)

      expect(textarea.value).toContain('foo: bar')
    })

    it('should update from object to null showing empty string', () => {
      const { rerender } = render(
        <ObjectInput object={{ foo: 'bar' }} setObject={() => {}} />
      )

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea.value).toContain('foo: bar')

      // simulate external object update from object to null
      rerender(<ObjectInput object={null} setObject={() => {}} />)

      // @note should show empty string, not "null" text
      expect(textarea.value).toBe('')
    })
  })
})
