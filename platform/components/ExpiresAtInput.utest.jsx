import ExpiresAtInput from './ExpiresAtInput'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

// @note isolate the field from the real dialog/portal machinery
jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: () => ({
    popup: null,
    openPopup: jest.fn(),
    closePopup: jest.fn(),
  }),
}))

const MS = new Date(2027, 11, 31, 23, 59).getTime()

describe('ExpiresAtInput', () => {
  function hiddenOf(container) {
    return container.querySelector('input[type="hidden"][name="expiresAt"]')
  }

  it('submits the default value as an epoch-ms timestamp in a hidden field', () => {
    const { container } = render(
      <ExpiresAtInput name="expiresAt" defaultValue={MS} />
    )

    const hidden = hiddenOf(container)

    expect(hidden).toBeInTheDocument()
    expect(hidden).toHaveAttribute('data-type', 'number-or-null')
    expect(Number(hidden.value)).toBe(MS)
  })

  it('submits an empty value and shows the placeholder when there is no expiry', () => {
    const { container, getByPlaceholderText } = render(
      <ExpiresAtInput name="expiresAt" defaultValue={null} />
    )

    expect(hiddenOf(container).value).toBe('')
    expect(getByPlaceholderText('No expiry')).toBeInTheDocument()
  })
})
