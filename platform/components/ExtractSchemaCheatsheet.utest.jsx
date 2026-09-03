import ExtractSchemaCheatsheet from './ExtractSchemaCheatsheet'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Expando', () => {
  return function MockExpando({ title, titleClassName, children, ...props }) {
    return (
      <div data-testid="expando" {...props}>
        <div className={titleClassName} data-testid="expando-title">
          {title}
        </div>
        <div data-testid="expando-content">{children}</div>
      </div>
    )
  }
})

describe('ExtractSchemaCheatsheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render Expando component', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByTestId('expando')).toBeInTheDocument()
    })

    it('should render with correct title', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByTestId('expando-title')).toHaveTextContent(
        'Schema Cheat Sheet'
      )
    })

    it('should apply correct titleClassName', () => {
      render(<ExtractSchemaCheatsheet />)

      const title = screen.getByTestId('expando-title')

      expect(title).toHaveClass('default-link', 'text-sm')
    })
  })

  describe('table structure', () => {
    it('should render table with headers', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('Property')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('should render all property types', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('type: "string"')).toBeInTheDocument()
      expect(screen.getByText('type: "number"')).toBeInTheDocument()
      expect(screen.getByText('type: "boolean"')).toBeInTheDocument()
    })

    it('should render description row', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('description')).toBeInTheDocument()
      expect(
        screen.getByText(/Describes what value to extract/)
      ).toBeInTheDocument()
    })

    it('should render required row', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('required: true')).toBeInTheDocument()
      expect(
        screen.getByText(/Marks the field as required/)
      ).toBeInTheDocument()
    })

    it('should render collect row', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('collect: true')).toBeInTheDocument()
      expect(screen.getByText(/Numeric fields only/)).toBeInTheDocument()
    })

    it('should render display row', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('display')).toBeInTheDocument()
      expect(screen.getByText(/Collected fields only/)).toBeInTheDocument()
      expect(screen.getByText('currency/USD')).toBeInTheDocument()
    })
  })

  describe('content descriptions', () => {
    it('should describe string type correctly', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(
        screen.getByText(
          /Extracts text values like names, emails, descriptions/
        )
      ).toBeInTheDocument()
    })

    it('should describe number type correctly', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(
        screen.getByText(
          /Extracts numeric values like amounts, quantities, ratings/
        )
      ).toBeInTheDocument()
    })

    it('should describe boolean type correctly', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(
        screen.getByText(/Extracts true\/false values for yes\/no questions/)
      ).toBeInTheDocument()
    })

    it('should describe collect property with emphasis on numeric fields', () => {
      render(<ExtractSchemaCheatsheet />)

      const collectDescription = screen.getByText(/Numeric fields only/)

      expect(collectDescription.tagName).toBe('STRONG')
    })
  })

  describe('example section', () => {
    it('should render example section', () => {
      render(<ExtractSchemaCheatsheet />)

      expect(screen.getByText('Example with metrics:')).toBeInTheDocument()
    })

    it('should render example code', () => {
      render(<ExtractSchemaCheatsheet />)

      const codeExample = screen.getByText(/orderAmount:/)

      expect(codeExample).toBeInTheDocument()
      expect(codeExample.textContent).toContain('type: number')
      expect(codeExample.textContent).toContain(
        'description: Total order amount'
      )
      expect(codeExample.textContent).toContain('collect: true')
      expect(codeExample.textContent).toContain('display: currency/USD')
    })

    it('should render example with proper formatting', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const pre = container.querySelector('pre')

      expect(pre).toBeInTheDocument()
      expect(pre).toHaveClass('text-xs')
    })
  })

  describe('styling', () => {
    it('should apply prose classes to content wrapper', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const contentWrapper = container.querySelector('.content-prose')

      expect(contentWrapper).toBeInTheDocument()
      expect(contentWrapper).toHaveClass('prose-code:before:content-none')
      expect(contentWrapper).toHaveClass('prose-code:after:content-none')
    })

    it('should apply font classes to description cells', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const fontMonoCells = container.querySelectorAll('.-font-mono')

      expect(fontMonoCells.length).toBeGreaterThan(0)
    })

    it('should apply background to example code block', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const pre = container.querySelector('pre')

      expect(pre).toHaveClass('bg-gray-100', 'dark:bg-gray-900')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to Expando', () => {
      render(<ExtractSchemaCheatsheet data-testid="custom-cheatsheet" />)

      expect(screen.getByTestId('custom-cheatsheet')).toBeInTheDocument()
    })

    it('should allow custom className', () => {
      render(<ExtractSchemaCheatsheet className="custom-class" />)

      const expando = screen.getByTestId('expando')

      expect(expando).toHaveClass('custom-class')
    })
  })

  describe('accessibility', () => {
    it('should use semantic table structure', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const table = container.querySelector('table')
      const thead = container.querySelector('thead')
      const tbody = container.querySelector('tbody')

      expect(table).toBeInTheDocument()
      expect(thead).toBeInTheDocument()
      expect(tbody).toBeInTheDocument()
    })

    it('should have proper table headers', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const headers = container.querySelectorAll('th')

      expect(headers).toHaveLength(2)
      expect(headers[0]).toHaveTextContent('Property')
      expect(headers[1]).toHaveTextContent('Description')
    })
  })

  describe('edge cases', () => {
    it('should render without errors when no props provided', () => {
      expect(() => render(<ExtractSchemaCheatsheet />)).not.toThrow()
    })

    it('should render all 7 table rows', () => {
      const { container } = render(<ExtractSchemaCheatsheet />)

      const rows = container.querySelectorAll('tbody tr')

      expect(rows).toHaveLength(7)
    })
  })
})
