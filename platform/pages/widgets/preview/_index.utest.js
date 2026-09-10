import { PreviewInput } from './index'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const push = jest.fn()

jest.mock('@/components/Hero', () => () => null)
jest.mock('@/components/Meta', () => () => null)

jest.mock('@/hooks/useRouter', () => jest.fn(() => ({ push })))
jest.mock('@/hooks/useTextAnimation', () => jest.fn(() => ''))

// @note jsdom does not expose form controls as named form properties, which
// the handler reads the value through
function submit(input) {
  const form = input.closest('form')

  Object.defineProperty(form, 'heroInput', { value: input })

  fireEvent.submit(form)
}

describe('PreviewInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps the port of an absolute url in the preview location', () => {
    render(<PreviewInput />)

    const input = screen.getByRole('textbox')

    fireEvent.change(input, {
      target: { value: 'https://example.com:8443/pricing' },
    })
    submit(input)

    // @note the hostname alone would preview a different origin
    expect(push).toHaveBeenCalledWith(
      '/widgets/preview/example.com:8443/pricing'
    )
  })

  it('passes a bare location through', () => {
    render(<PreviewInput />)

    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'notion.so' } })
    submit(input)

    expect(push).toHaveBeenCalledWith('/widgets/preview/notion.so')
  })
})
