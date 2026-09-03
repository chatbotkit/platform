/* eslint-disable @typescript-eslint/no-require-imports */
import RevealTextarea from './RevealTextarea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/AutoTextarea', () => {
  const { forwardRef } = require('react')

  return forwardRef(function MockAutoTextarea(props, ref) {
    return <textarea ref={ref} {...props} />
  })
})

describe('RevealTextarea', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default token and component defaults', () => {
    render(<RevealTextarea defaultToken="secret-value" />)

    const textarea = screen.getByRole('textbox')

    expect(textarea).toHaveValue('secret-value')
    expect(textarea).toHaveAttribute('autocomplete', 'off')
    expect(textarea).toHaveAttribute('spellcheck', 'false')
    expect(textarea).toHaveClass('font-mono')
    expect(textarea).toHaveClass('break-all')
  })

  it('updates value and calls onChange in uncontrolled mode', () => {
    const onChange = jest.fn()

    render(<RevealTextarea onChange={onChange} />)

    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: 'next-value' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(textarea).toHaveValue('next-value')
  })

  it('uses controlled state callback when token and setToken are provided', () => {
    const setToken = jest.fn()

    render(<RevealTextarea token="controlled" setToken={setToken} />)

    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: 'changed' } })

    expect(setToken).toHaveBeenCalledWith('changed')
    expect(textarea).toHaveValue('controlled')
  })

  it('forwards ref and merges className', () => {
    const ref = { current: null }

    render(<RevealTextarea ref={ref} className="custom-class" />)

    const textarea = screen.getByRole('textbox')

    expect(ref.current).toBe(textarea)
    expect(textarea).toHaveClass('custom-class')
    expect(textarea).toHaveClass('font-mono')
  })
})
