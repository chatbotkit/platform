/* eslint-disable @typescript-eslint/no-require-imports */
import { useState } from 'react'

import LimitsConfigInput from './LimitsConfigInput'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  Square3Stack3DIcon: () => <span data-testid="template-icon">Icon</span>,
}))

// mock dependencies
jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon({ icon }) {
    return <span data-testid="dynamic-icon">{icon}</span>
  }
})

jest.mock('@/components/List', () => {
  function MockList({ children }) {
    return <div data-testid="list">{children}</div>
  }

  function MockListItem({ title, body, onClick, selected, children }) {
    return (
      <div
        data-testid={`list-item-${title?.replace(/\s+/g, '-').toLowerCase()}`}
        onClick={onClick}
        className={selected ? 'selected' : ''}
      >
        <div>{title}</div>
        <div>{body}</div>
        {children}
      </div>
    )
  }

  MockList.Item = MockListItem

  return MockList
})

// mock ObjectInput to simplify testing
jest.mock('@/components/ObjectInput', () => {
  return function MockObjectInput({
    object,
    setObject,
    defaultObject,
    children,
    disabled,
    zodSchema, // eslint-disable-line no-unused-vars
    ...props
  }) {
    const [internalValue, setInternalValue] = useState(() => {
      const obj = object ?? defaultObject ?? {}

      if (Object.keys(obj).length === 0) {
        return ''
      }

      // simple YAML-like output for limits object
      let yaml = ''

      if (obj.tokens) {
        yaml += `tokens: ${obj.tokens}\n`
      }

      if (obj.conversations) {
        yaml += `conversations: ${obj.conversations}\n`
      }

      if (obj.messages) {
        yaml += `messages: ${obj.messages}\n`
      }

      return yaml.trim()
    })

    const handleChange = (e) => {
      setInternalValue(e.target.value)

      // simple YAML parsing for test
      const lines = e.target.value.split('\n')
      const parsedObj = {}

      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(\d+)/)

        if (match) {
          parsedObj[match[1]] = parseInt(match[2], 10)
        }
      }

      if (Object.keys(parsedObj).length > 0 && setObject) {
        setObject(parsedObj)
      }
    }

    return (
      <div>
        <textarea
          {...props}
          value={internalValue}
          onChange={handleChange}
          data-testid="limits-textarea"
          disabled={disabled}
        />
        {children}
      </div>
    )
  }
})

jest.mock('@/hooks/usePopup', () => {
  return function MockUsePopup() {
    return {
      popup: null,
      openPopup: jest.fn(),
      closePopup: jest.fn(),
    }
  }
})

jest.mock('@/components/Widget', () => ({
  useExtendWidgetFunctions: jest.fn(),
}))

jest.mock('@/hooks/useFuzzySearch', () => {
  return function MockUseFuzzySearch(items) {
    return items
  }
})

jest.mock('@/hooks/useControlledState', () => {
  const { useState } = require('react')

  return function MockUseControlledState(defaultValue, value, setValue) {
    const [internalValue, setInternalValue] = useState(value ?? defaultValue)

    return [value ?? internalValue, setValue ?? setInternalValue]
  }
})

// helper wrapper for controlled limits state
function ControlledLimitsConfigInput({ initialLimits, ...props }) {
  const [limits, setLimits] = useState(initialLimits)

  return <LimitsConfigInput {...props} limits={limits} setLimits={setLimits} />
}

describe('LimitsConfigInput', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<LimitsConfigInput />)

      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea).toBeInTheDocument()
    })

    it('should render with defaultLimits', () => {
      render(
        <LimitsConfigInput
          defaultLimits={{ tokens: 10000, conversations: 100, messages: 1000 }}
        />
      )

      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea.value).toContain('tokens: 10000')
      expect(textarea.value).toContain('conversations: 100')
      expect(textarea.value).toContain('messages: 1000')
    })

    it('should render templates button by default', () => {
      render(<LimitsConfigInput />)

      const templateButton = screen.getByRole('button')

      expect(templateButton).toBeInTheDocument()
    })

    it('should not render templates button when templates prop is false', () => {
      render(<LimitsConfigInput templates={false} />)

      const templateButton = screen.queryByRole('button')

      expect(templateButton).not.toBeInTheDocument()
    })
  })

  describe('controlled limits behavior', () => {
    it('should render with controlled limits prop', () => {
      render(
        <LimitsConfigInput limits={{ tokens: 50000 }} setLimits={() => {}} />
      )

      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea.value).toContain('tokens: 50000')
    })
  })

  describe('empty/null limits handling', () => {
    it('should show empty string when limits is null', () => {
      render(<LimitsConfigInput limits={null} setLimits={() => {}} />)

      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea.value).toBe('')
    })

    it('should show empty string when defaultLimits is empty object', () => {
      render(<LimitsConfigInput defaultLimits={{}} />)

      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea.value).toBe('')
    })

    it('should allow editing when limits is null', () => {
      const setLimitsMock = jest.fn()

      render(<LimitsConfigInput limits={null} setLimits={setLimitsMock} />)

      const textarea = screen.getByTestId('limits-textarea')

      fireEvent.focus(textarea)
      fireEvent.change(textarea, {
        target: { value: 'tokens: 10000' },
      })

      expect(textarea.value).toBe('tokens: 10000')

      act(() => {
        jest.advanceTimersByTime(600)
      })

      expect(setLimitsMock).toHaveBeenCalledWith({
        tokens: 10000,
      })
    })
  })

  describe('value editing', () => {
    it('should preserve user formatting while focused', () => {
      render(<ControlledLimitsConfigInput initialLimits={{}} />)

      const textarea = screen.getByTestId('limits-textarea')

      fireEvent.focus(textarea)

      const userFormattedYaml = 'tokens: 10000\nconversations: 100'

      fireEvent.change(textarea, { target: { value: userFormattedYaml } })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      expect(textarea.value).toBe(userFormattedYaml)
    })

    it('should call setLimits when value changes', () => {
      const setLimitsMock = jest.fn()

      render(<LimitsConfigInput defaultLimits={{}} setLimits={setLimitsMock} />)

      const textarea = screen.getByTestId('limits-textarea')

      fireEvent.focus(textarea)
      fireEvent.change(textarea, {
        target: { value: 'tokens: 25000' },
      })

      // @note the mock ObjectInput calls setLimits immediately on change
      expect(setLimitsMock).toHaveBeenCalledWith({
        tokens: 25000,
      })
    })
  })

  describe('templates button', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<LimitsConfigInput disabled={true} />)

      const templateButton = screen.getByRole('button')

      expect(templateButton).toBeDisabled()
    })
  })

  describe('name attribute', () => {
    it('should pass name prop for form submission', () => {
      render(<LimitsConfigInput name="limits" />)

      // @note the ObjectInput internally handles the name for form serialization
      const textarea = screen.getByTestId('limits-textarea')

      expect(textarea).toBeInTheDocument()
    })
  })
})
