import InputArea from './InputArea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('InputArea', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders a single-row textarea with base class', () => {
    render(<InputArea aria-label="Message" />)

    const textarea = screen.getByRole('textbox', { name: 'Message' })

    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveAttribute('rows', '1')
    expect(textarea).toHaveClass('resize-none')
  })

  it('merges custom class names', () => {
    render(<InputArea aria-label="Message" className="custom-class" />)

    expect(screen.getByRole('textbox')).toHaveClass(
      'resize-none',
      'custom-class'
    )
  })

  it('forwards regular textarea props and events', () => {
    const onChange = jest.fn()

    render(
      <InputArea
        aria-label="Message"
        placeholder="Write here"
        defaultValue="initial"
        onChange={onChange}
      />
    )

    const textarea = screen.getByRole('textbox')

    expect(textarea).toHaveAttribute('placeholder', 'Write here')
    expect(textarea).toHaveValue('initial')

    fireEvent.change(textarea, { target: { value: 'updated' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not pass through ignored type prop', () => {
    render(<InputArea aria-label="Message" type="password" />)

    expect(screen.getByRole('textbox')).not.toHaveAttribute('type')
  })
})
