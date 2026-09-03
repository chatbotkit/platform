/* eslint-disable @typescript-eslint/no-require-imports */
import MetaInput from './MetaInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock dependencies
jest.mock('@/lib/yaml', () => ({
  parse: jest.fn((str) => {
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }),
  tryStringify: jest.fn((obj) => JSON.stringify(obj, null, 2)),
}))

jest.mock('@/components/DynamicIcon', () => {
  return function DynamicIcon({ icon, className }) {
    return (
      <div data-testid="dynamic-icon" data-icon={icon} className={className} />
    )
  }
})

jest.mock('@/components/ObjectInput', () => {
  return function ObjectInput({
    object,
    setObject,
    children,
    className,
    disabled,
  }) {
    return (
      <div data-testid="object-input" className={className}>
        <textarea
          data-testid="object-textarea"
          value={JSON.stringify(object || {})}
          onChange={(e) => {
            try {
              setObject(JSON.parse(e.target.value))
            } catch {
              // Invalid JSON, ignore
            }
          }}
          disabled={disabled}
        />
        {children}
      </div>
    )
  }
})

jest.mock('@/hooks/useControlledState', () => {
  return jest.fn((defaultValue, value, setValue) => {
    const React = require('react')
    const [state, setState] = React.useState(value ?? defaultValue)

    React.useEffect(() => {
      if (value !== undefined) {
        setState(value)
      }
    }, [value])

    const updateState = React.useCallback(
      (newValue) => {
        setState(newValue)
        setValue?.(newValue)
      },
      [setValue]
    )

    return [state, updateState]
  })
})

jest.mock('@/hooks/useFuzzySearch', () => {
  return jest.fn((items, search) => {
    if (!search) {
      return items
    }

    return items.filter((item) =>
      item.name?.toLowerCase().includes(search.toLowerCase())
    )
  })
})

jest.mock('@/hooks/usePopup', () => {
  return jest.fn(() => {
    const React = require('react')
    const [popup, setPopup] = React.useState(null)

    return {
      popup,
      openPopup: (content, options) => {
        setPopup({ content, options })
      },
      closePopup: () => setPopup(null),
    }
  })
})

describe('MetaInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render ObjectInput', () => {
      render(<MetaInput />)
      expect(screen.getByTestId('object-input')).toBeInTheDocument()
    })

    it('should apply className to ObjectInput', () => {
      render(<MetaInput className="custom-class" />)
      expect(screen.getByTestId('object-input')).toHaveClass(
        'default-input',
        'w-full',
        'custom-class'
      )
    })

    it('should not render template button when templates is false', () => {
      render(<MetaInput templates={false} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should not render template button when META_TEMPLATES is empty', () => {
      render(<MetaInput templates={true} />)
      // META_TEMPLATES is empty by default
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('controlled state', () => {
    it('should work as controlled component', () => {
      const setMeta = jest.fn()
      const meta = { key: 'value' }

      render(<MetaInput meta={meta} setMeta={setMeta} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue(JSON.stringify(meta))
    })

    it('should work as uncontrolled component with defaultMeta', () => {
      const defaultMeta = { default: 'value' }

      render(<MetaInput defaultMeta={defaultMeta} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue(JSON.stringify(defaultMeta))
    })

    it('should call setMeta when ObjectInput changes', () => {
      const setMeta = jest.fn()

      render(<MetaInput meta={{}} setMeta={setMeta} />)

      const textarea = screen.getByTestId('object-textarea')
      const newValue = { updated: 'data' }

      fireEvent.change(textarea, {
        target: { value: JSON.stringify(newValue) },
      })

      expect(setMeta).toHaveBeenCalledWith(newValue)
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ObjectInput', () => {
      render(
        <MetaInput placeholder="Enter metadata" data-testid="custom-input" />
      )

      expect(screen.getByTestId('object-input')).toBeInTheDocument()
    })

    it('should forward disabled prop to ObjectInput', () => {
      render(<MetaInput disabled />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toBeDisabled()
    })
  })

  describe('useControlledState hook usage', () => {
    it('should use useControlledState with correct parameters', () => {
      const useControlledState = require('@/hooks/useControlledState')
      const defaultMeta = { default: 'value' }
      const meta = { key: 'value' }
      const setMeta = jest.fn()

      render(
        <MetaInput defaultMeta={defaultMeta} meta={meta} setMeta={setMeta} />
      )

      expect(useControlledState).toHaveBeenCalledWith(
        defaultMeta,
        meta,
        setMeta
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null meta', () => {
      render(<MetaInput meta={null} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue('{}')
    })

    it('should handle undefined meta', () => {
      render(<MetaInput />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue('{}')
    })

    it('should handle empty object meta', () => {
      render(<MetaInput meta={{}} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue('{}')
    })

    it('should handle complex nested meta', () => {
      const complexMeta = {
        nested: {
          deeply: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      }

      render(<MetaInput meta={complexMeta} />)

      const textarea = screen.getByTestId('object-textarea')

      expect(textarea).toHaveValue(JSON.stringify(complexMeta))
    })
  })
})
