/* eslint-disable @typescript-eslint/no-require-imports */
import { useState } from 'react'

import PolicyConfigInput from './PolicyConfigInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockUseExtendWidgetFunctions = jest.fn()
const mockGetRandomId = jest.fn(() => 'abc123')

jest.mock('@/prisma/zod', () => ({
  PolicyConfig: {},
  RetentionPolicyConfig: { policyType: 'retention' },
  UsagePolicyConfig: { policyType: 'usage' },
}))

jest.mock('@/prisma/types', () => ({
  PolicyType: {
    retention: 'retention',
    usage: 'usage',
  },
}))

jest.mock('@/lib/string', () => ({
  getRandomId: (...args) => mockGetRandomId(...args),
}))

jest.mock('@/lib/yaml', () => ({
  tryStringify: jest.fn((value) => JSON.stringify(value)),
}))

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

jest.mock('@/components/ObjectInput', () => {
  return function MockObjectInput({
    object,
    setObject,
    children,
    zodSchema,
    wrapperClassName,
    ...props
  }) {
    const [internalValue, setInternalValue] = useState(
      object ? JSON.stringify(object) : ''
    )

    return (
      <div
        data-testid="policy-config-object-input"
        className={wrapperClassName}
        data-zod-schema={zodSchema?.policyType || 'policy'}
      >
        <textarea
          {...props}
          value={internalValue}
          onChange={(e) => {
            setInternalValue(e.target.value)
            setObject?.({ updated: e.target.value })
          }}
          data-testid="policy-config-textarea"
        />
        {children}
      </div>
    )
  }
})

jest.mock('@/components/Widget', () => ({
  useExtendWidgetFunctions: (...args) => mockUseExtendWidgetFunctions(...args),
}))

jest.mock('@/hooks/useControlledState', () => {
  const { useState } = require('react')

  return function MockUseControlledState(defaultValue, value, setValue) {
    const [internalValue, setInternalValue] = useState(value ?? defaultValue)

    return [value ?? internalValue, setValue ?? setInternalValue]
  }
})

jest.mock('@/hooks/useFuzzySearch', () => {
  return function MockUseFuzzySearch(items) {
    return items
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

jest.mock('@heroicons/react/24/outline', () => ({
  Square3Stack3DIcon: () => <span data-testid="template-icon">Icon</span>,
}))

function getConfig(container) {
  const hidden = container.querySelector('input[name="config"]')

  return JSON.parse(hidden.value)
}

describe('PolicyConfigInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetRandomId.mockReturnValue('abc123')
  })

  it('renders a raw object input with templates by default', () => {
    render(<PolicyConfigInput defaultConfig={{ expiresInDays: 7 }} />)

    expect(screen.getByTestId('policy-config-textarea')).toHaveValue(
      JSON.stringify({ expiresInDays: 7 })
    )
    expect(screen.getAllByText('Templates').length).toBeGreaterThan(0)
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument()
  })

  it('applies wrapper and legacy tabs classes to the object input root', () => {
    render(
      <PolicyConfigInput
        wrapperClassName="flex-1"
        tabsClassName="compact-tabs"
      />
    )

    const input = screen.getByTestId('policy-config-object-input')

    expect(input).toHaveClass('w-full')
    expect(input).toHaveClass('flex-1')
    expect(input).toHaveClass('compact-tabs')
  })

  it('uses controlled retention config and propagates updates', () => {
    const setConfig = jest.fn()

    render(
      <PolicyConfigInput config={{ expiresInDays: 7 }} setConfig={setConfig} />
    )

    setConfig.mockClear()

    fireEvent.change(screen.getByTestId('policy-config-textarea'), {
      target: { value: 'expiresInDays: 30' },
    })

    expect(setConfig).toHaveBeenCalledWith({ updated: 'expiresInDays: 30' })
  })

  it('registers widget functions with stable generated id', async () => {
    render(<PolicyConfigInput config={{ expiresInDays: 7 }} />)

    expect(mockUseExtendWidgetFunctions).toHaveBeenCalledTimes(1)

    const widgetFunctions = mockUseExtendWidgetFunctions.mock.calls[0][0]

    expect(widgetFunctions).toHaveProperty('policy_config_input_get_abc123')
    expect(widgetFunctions).toHaveProperty('policy_config_input_set_abc123')

    await expect(
      widgetFunctions.policy_config_input_get_abc123.handler()
    ).resolves.toEqual({ value: { expiresInDays: 7 } })
  })

  it('hides templates button when templates is false', () => {
    render(<PolicyConfigInput templates={false} />)
    expect(screen.queryByTestId('template-icon')).not.toBeInTheDocument()
  })

  it('renders a hidden object field for usage policies', () => {
    const { container } = render(
      <PolicyConfigInput
        type="usage"
        name="config"
        defaultConfig={{ metric: 'tokens' }}
      />
    )

    expect(container.querySelector('input[name="config"]')).toHaveAttribute(
      'data-type',
      'object'
    )
    expect(screen.getByTestId('policy-config-textarea')).toBeInTheDocument()
    expect(screen.getByTestId('policy-config-object-input')).toHaveAttribute(
      'data-zod-schema',
      'usage'
    )
  })

  it('serializes an empty config as an object', () => {
    const { container } = render(
      <PolicyConfigInput type="usage" name="config" />
    )

    expect(getConfig(container)).toEqual({})
  })

  it('seeds usage config from an existing config', () => {
    const { container } = render(
      <PolicyConfigInput
        type="usage"
        name="config"
        defaultConfig={{
          metric: 'messages',
          threshold: 50,
          windowInSeconds: 600,
          actions: { email: { to: ['a@example.com'] } },
        }}
      />
    )

    const config = getConfig(container)

    expect(config.metric).toBe('messages')
    expect(config.threshold).toBe(50)
    expect(config.actions.email.to).toEqual(['a@example.com'])
    expect(config.actions.block).toBeUndefined()
  })

  it('updates serialized usage config when the raw object changes', () => {
    const { container } = render(
      <PolicyConfigInput type="usage" name="config" />
    )

    fireEvent.change(screen.getByTestId('policy-config-textarea'), {
      target: { value: 'metric: tokens' },
    })

    expect(getConfig(container)).toEqual({ updated: 'metric: tokens' })
  })

  it('reseeds defaults when the policy type is switched', () => {
    const { container, rerender } = render(
      <PolicyConfigInput
        type="retention"
        name="config"
        defaultConfig={{ expiresInDays: 7 }}
      />
    )

    expect(getConfig(container)).toEqual({ expiresInDays: 7 })

    rerender(
      <PolicyConfigInput
        type="usage"
        name="config"
        defaultConfig={{ expiresInDays: 7 }}
      />
    )

    const config = getConfig(container)

    expect(config.metric).toBe('tokens')
    expect(config.windowInSeconds).toBe(86400)
    expect(config.actions.block.durationInSeconds).toBe(3600)
  })

  it('preserves nested usage recipients in raw config', () => {
    const { container } = render(
      <PolicyConfigInput
        type="usage"
        name="config"
        defaultConfig={{
          metric: 'messages',
          threshold: 50,
          windowInSeconds: 600,
          actions: { email: { to: ['owner@example.com'] } },
        }}
      />
    )

    expect(getConfig(container).actions.email.to).toEqual([
      'owner@example.com',
    ])
    expect(screen.getByTestId('policy-config-textarea')).toHaveValue(
      JSON.stringify({
        metric: 'messages',
        threshold: 50,
        windowInSeconds: 600,
        actions: { email: { to: ['owner@example.com'] } },
      })
    )
  })
})
