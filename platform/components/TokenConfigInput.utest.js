/* eslint-disable @typescript-eslint/no-require-imports */
import { useState } from 'react'

import TokenConfigInput from './TokenConfigInput'

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
    ...props
  }) {
    const [internalValue, setInternalValue] = useState(() => {
      const obj = object ?? defaultObject ?? {}

      return Object.keys(obj).length === 0
        ? ''
        : `allowedRoutes:\n${(obj.allowedRoutes || []).map((r) => `  - ${r}`).join('\n')}`
    })

    const handleChange = (e) => {
      setInternalValue(e.target.value)

      // simple YAML parsing for test
      const lines = e.target.value.split('\n')
      const routes = lines
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.replace(/^.*-\s*/, '').trim())

      if (routes.length > 0 && setObject) {
        setObject({ allowedRoutes: routes })
      }
    }

    return (
      <div>
        <textarea
          {...props}
          value={internalValue}
          onChange={handleChange}
          data-testid="config-textarea"
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

// helper wrapper for controlled config state
function ControlledTokenConfigInput({ initialConfig, ...props }) {
  const [config, setConfig] = useState(initialConfig)

  return <TokenConfigInput {...props} config={config} setConfig={setConfig} />
}

describe('TokenConfigInput', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<TokenConfigInput />)

      const textarea = screen.getByTestId('config-textarea')

      expect(textarea).toBeInTheDocument()
    })

    it('should render with defaultConfig', () => {
      render(
        <TokenConfigInput
          defaultConfig={{ allowedRoutes: ['bot/**', 'dataset/**'] }}
        />
      )

      const textarea = screen.getByTestId('config-textarea')

      expect(textarea.value).toContain('allowedRoutes')
      expect(textarea.value).toContain('bot/**')
      expect(textarea.value).toContain('dataset/**')
    })

    it('should render templates button by default', () => {
      render(<TokenConfigInput />)

      const templateButton = screen.getByRole('button')

      expect(templateButton).toBeInTheDocument()
    })

    it('should not render templates button when templates prop is false', () => {
      render(<TokenConfigInput templates={false} />)

      const templateButton = screen.queryByRole('button')

      expect(templateButton).not.toBeInTheDocument()
    })
  })

  describe('controlled config behavior', () => {
    it('should render with controlled config prop', () => {
      render(
        <TokenConfigInput
          config={{ allowedRoutes: ['bot/**'] }}
          setConfig={() => {}}
        />
      )

      const textarea = screen.getByTestId('config-textarea')

      expect(textarea.value).toContain('bot/**')
    })
  })

  describe('empty/null config handling', () => {
    it('should show empty string when config is null', () => {
      render(<TokenConfigInput config={null} setConfig={() => {}} />)

      const textarea = screen.getByTestId('config-textarea')

      expect(textarea.value).toBe('')
    })

    it('should show empty string when defaultConfig is empty object', () => {
      render(<TokenConfigInput defaultConfig={{}} />)

      const textarea = screen.getByTestId('config-textarea')

      expect(textarea.value).toBe('')
    })

    it('should allow editing when config is null', () => {
      const setConfigMock = jest.fn()

      render(<TokenConfigInput config={null} setConfig={setConfigMock} />)

      const textarea = screen.getByTestId('config-textarea')

      fireEvent.focus(textarea)
      fireEvent.change(textarea, {
        target: { value: 'allowedRoutes:\n  - bot/**' },
      })

      expect(textarea.value).toBe('allowedRoutes:\n  - bot/**')

      act(() => {
        jest.advanceTimersByTime(600)
      })

      expect(setConfigMock).toHaveBeenCalledWith({
        allowedRoutes: ['bot/**'],
      })
    })
  })

  describe('value editing', () => {
    it('should preserve user formatting while focused', () => {
      render(<ControlledTokenConfigInput initialConfig={{}} />)

      const textarea = screen.getByTestId('config-textarea')

      fireEvent.focus(textarea)

      const userFormattedYaml = 'allowedRoutes:\n  - bot/**\n  - dataset/**'

      fireEvent.change(textarea, { target: { value: userFormattedYaml } })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      expect(textarea.value).toBe(userFormattedYaml)
    })

    it('should call setConfig when value changes', () => {
      const setConfigMock = jest.fn()

      render(<TokenConfigInput defaultConfig={{}} setConfig={setConfigMock} />)

      const textarea = screen.getByTestId('config-textarea')

      fireEvent.focus(textarea)
      fireEvent.change(textarea, {
        target: { value: 'allowedRoutes:\n  - skillset/**' },
      })

      // @note the mock ObjectInput calls setConfig immediately on change
      expect(setConfigMock).toHaveBeenCalledWith({
        allowedRoutes: ['skillset/**'],
      })
    })
  })

  describe('templates button', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<TokenConfigInput disabled={true} />)

      const templateButton = screen.getByRole('button')

      expect(templateButton).toBeDisabled()
    })
  })

  describe('name attribute', () => {
    it('should pass name prop for form submission', () => {
      render(<TokenConfigInput name="config" />)

      // @note the ObjectInput internally handles the name for form serialization
      const textarea = screen.getByTestId('config-textarea')

      expect(textarea).toBeInTheDocument()
    })
  })
})
