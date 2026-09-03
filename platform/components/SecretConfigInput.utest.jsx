/* eslint-disable @typescript-eslint/no-require-imports */
import SecretConfigInput from './SecretConfigInput'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/prisma/zod', () => ({
  SecretConfig: (() => {
    const { z } = require('zod')

    return z.record(z.any()).nullable()
  })(),
}))

jest.mock('@/lib/template', () => ({
  getTemplate: jest.fn((name, catalogue) => {
    if (!name) {
      return null
    }

    const normalizedName = String(name).toLowerCase().replace(/^@/, '')

    return catalogue[normalizedName] || null
  }),
}))

jest.mock('@/components/ObjectInput', () => {
  return function ObjectInput({ object, zodSchema, className, disabled }) {
    const result = zodSchema?.safeParse?.(object)

    return (
      <div
        data-testid="object-input"
        data-valid={String(result?.success ?? true)}
        data-error={
          result?.success ? '' : (result?.error?.issues?.[0]?.message ?? '')
        }
        data-disabled={String(Boolean(disabled))}
        className={className}
      />
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

describe('SecretConfigInput', () => {
  const templates = {
    'platform/existing-secret': {
      name: 'Existing Secret',
    },
  }

  it('renders ObjectInput with default classes', () => {
    render(<SecretConfigInput />)

    expect(screen.getByTestId('object-input')).toHaveClass(
      'default-input',
      'w-full'
    )
  })

  it('marks template config invalid when the template does not exist', () => {
    render(
      <SecretConfigInput
        secretType="template"
        config={{ template: 'platform/missing-secret' }}
        templates={templates}
      />
    )

    expect(screen.getByTestId('object-input')).toHaveAttribute(
      'data-valid',
      'false'
    )
    expect(screen.getByTestId('object-input')).toHaveAttribute(
      'data-error',
      'The selected secret template does not exist.'
    )
  })

  it('accepts template config when the template exists', () => {
    render(
      <SecretConfigInput
        secretType="template"
        config={{ template: 'platform/existing-secret' }}
        templates={templates}
      />
    )

    expect(screen.getByTestId('object-input')).toHaveAttribute(
      'data-valid',
      'true'
    )
  })

  it('accepts non-template config without checking template existence', () => {
    render(
      <SecretConfigInput
        secretType="oauth"
        config={{ template: 'platform/missing-secret' }}
      />
    )

    expect(screen.getByTestId('object-input')).toHaveAttribute(
      'data-valid',
      'true'
    )
  })
})
