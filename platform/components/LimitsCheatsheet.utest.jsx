import LimitsCheatsheet from './LimitsCheatsheet'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Expando', () => {
  return function Expando({ title, titleClassName, children, ...props }) {
    return (
      <div data-testid="expando" {...props}>
        <button type="button" className={titleClassName}>
          {title}
        </button>
        <div data-testid="expando-content">{children}</div>
      </div>
    )
  }
})

describe('LimitsCheatsheet', () => {
  describe('basic functionality', () => {
    it('should render the component', () => {
      render(<LimitsCheatsheet />)

      expect(screen.getByText('Limits Cheat Sheet')).toBeInTheDocument()
    })

    it('should render inside Expando component', () => {
      render(<LimitsCheatsheet />)

      const expando = screen.getByTestId('expando')

      expect(expando).toBeInTheDocument()
    })

    it('should pass title to Expando', () => {
      render(<LimitsCheatsheet />)

      expect(screen.getByText('Limits Cheat Sheet')).toBeInTheDocument()
    })

    it('should pass titleClassName to Expando', () => {
      render(<LimitsCheatsheet />)

      const title = screen.getByText('Limits Cheat Sheet')

      expect(title).toHaveClass('default-link')
      expect(title).toHaveClass('text-sm')
    })
  })

  describe('table content', () => {
    it('should render a table', () => {
      render(<LimitsCheatsheet />)

      const table = screen.getByRole('table')

      expect(table).toBeInTheDocument()
    })

    it('should render table headers', () => {
      render(<LimitsCheatsheet />)

      expect(
        screen.getByRole('columnheader', { name: 'Name' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('columnheader', { name: 'Description' })
      ).toBeInTheDocument()
    })

    it('should render tokens limit row', () => {
      render(<LimitsCheatsheet />)

      const rows = screen.getAllByRole('row')
      const tokensRow = rows.find((row) => row.textContent.includes('tokens'))

      expect(tokensRow).toBeInTheDocument()
      expect(tokensRow).toHaveTextContent(
        'The number of tokens the user can use'
      )
    })

    it('should render conversations limit row', () => {
      render(<LimitsCheatsheet />)

      const rows = screen.getAllByRole('row')
      const conversationsRow = rows.find((row) =>
        row.textContent.includes('conversations')
      )

      expect(conversationsRow).toBeInTheDocument()
      expect(conversationsRow).toHaveTextContent(
        'The number of conversations the user can create'
      )
    })

    it('should render messages limit row', () => {
      render(<LimitsCheatsheet />)

      const rows = screen.getAllByRole('row')
      const messagesRow = rows.find((row) =>
        row.textContent.includes('messages')
      )

      expect(messagesRow).toBeInTheDocument()
      expect(messagesRow).toHaveTextContent(
        'The number of messages the user can send'
      )
    })

    it('should render limit names as code elements', () => {
      render(<LimitsCheatsheet />)

      const codeElements = screen.getAllByRole('cell').filter((cell) => {
        const code = cell.querySelector('code')

        return code !== null
      })

      expect(codeElements.length).toBeGreaterThan(0)

      const tokensCode = screen.getByText('tokens')

      expect(tokensCode.tagName).toBe('CODE')

      const conversationsCode = screen.getByText('conversations')

      expect(conversationsCode.tagName).toBe('CODE')

      const messagesCode = screen.getByText('messages')

      expect(messagesCode.tagName).toBe('CODE')
    })

    it('should render all three limit types', () => {
      render(<LimitsCheatsheet />)

      const rows = screen.getAllByRole('row')

      // 1 header row + 3 data rows
      expect(rows.length).toBe(4)
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to Expando', () => {
      render(<LimitsCheatsheet data-custom="test-value" />)

      const expando = screen.getByTestId('expando')

      expect(expando).toHaveAttribute('data-custom', 'test-value')
    })

    it('should forward className prop', () => {
      render(<LimitsCheatsheet className="custom-class" />)

      const expando = screen.getByTestId('expando')

      expect(expando).toHaveClass('custom-class')
    })

    it('should forward id prop', () => {
      render(<LimitsCheatsheet id="custom-id" />)

      const expando = screen.getByTestId('expando')

      expect(expando).toHaveAttribute('id', 'custom-id')
    })
  })

  describe('styling', () => {
    it('should apply prose classes to table container', () => {
      render(<LimitsCheatsheet />)

      const container = screen.getByTestId('expando-content').firstChild

      expect(container).toHaveClass('content-prose')
      expect(container).toHaveClass('prose-code:before:content-none')
      expect(container).toHaveClass('prose-code:after:content-none')
    })

    it('should apply text-bold class to table header', () => {
      render(<LimitsCheatsheet />)

      const thead = screen.getByRole('table').querySelector('thead')

      expect(thead).toHaveClass('text-bold')
    })
  })

  describe('accessibility', () => {
    it('should have proper table structure for screen readers', () => {
      render(<LimitsCheatsheet />)

      const table = screen.getByRole('table')
      const headers = screen.getAllByRole('columnheader')
      const rows = screen.getAllByRole('row')

      expect(table).toBeInTheDocument()
      expect(headers).toHaveLength(2)
      expect(rows.length).toBeGreaterThan(1) // Header + data rows
    })

    it('should use semantic table elements', () => {
      const { container } = render(<LimitsCheatsheet />)

      const thead = container.querySelector('thead')
      const tbody = container.querySelector('tbody')
      const th = container.querySelectorAll('th')
      const td = container.querySelectorAll('td')

      expect(thead).toBeInTheDocument()
      expect(tbody).toBeInTheDocument()
      expect(th.length).toBe(2)
      expect(td.length).toBe(6) // 3 rows × 2 columns
    })
  })

  describe('edge cases', () => {
    it('should render without crashing when no props provided', () => {
      expect(() => render(<LimitsCheatsheet />)).not.toThrow()
    })

    it('should render consistently on multiple renders', () => {
      const { rerender } = render(<LimitsCheatsheet />)

      const firstRows = screen.getAllByRole('row')

      expect(firstRows.length).toBe(4)

      rerender(<LimitsCheatsheet />)

      const secondRows = screen.getAllByRole('row')

      expect(secondRows.length).toBe(4)
    })
  })
})
