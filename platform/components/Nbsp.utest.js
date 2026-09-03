import Nbsp from './Nbsp'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Nbsp', () => {
  describe('rendering', () => {
    it('should render a non-breaking space', () => {
      const { container } = render(<Nbsp />)

      expect(container.innerHTML).toContain('&nbsp;')
      expect(container.textContent).toBe('\u00a0')
    })

    it('should render as a text node without wrapper elements', () => {
      const { container } = render(<Nbsp />)

      // Should render as a text node, not wrapped in an element
      expect(container.firstChild.nodeType).toBe(Node.TEXT_NODE)
      expect(container.firstChild.textContent).toBe('\u00a0')
    })

    it('should have a single non-breaking space character', () => {
      const { container } = render(<Nbsp />)

      expect(container.textContent).toHaveLength(1)
      expect(container.textContent.charCodeAt(0)).toBe(160) // non-breaking space character code
    })
  })
})
