import NoSsr from './NoSsr'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('next/dynamic', () => {
  return () =>
    function MockNoSsr({ children }) {
      return children || null
    }
})

describe('NoSsr', () => {
  it('renders children', () => {
    const { getByText } = render(
      <NoSsr>
        <span>child content</span>
      </NoSsr>
    )

    expect(getByText('child content')).toBeInTheDocument()
  })

  it('renders no output without children', () => {
    const { container } = render(<NoSsr />)

    expect(container).toBeEmptyDOMElement()
  })
})
