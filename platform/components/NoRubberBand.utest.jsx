import NoRubberBand from './NoRubberBand'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('NoRubberBand', () => {
  it('renders a global style tag', () => {
    render(<NoRubberBand />)
    expect(document.head.querySelector('style')).toBeInTheDocument()
  })

  it('sets vertical overscroll behavior on html and body', () => {
    render(<NoRubberBand />)

    const styles = document.head.textContent || ''

    expect(styles).toContain('html')
    expect(styles).toContain('body')
    expect(styles).toContain('overscroll-behavior-y:none')
  })
})
