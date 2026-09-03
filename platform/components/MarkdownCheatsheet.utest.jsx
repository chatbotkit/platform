import MarkdownCheatsheet from './MarkdownCheatsheet'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Expando', () => {
  return function Expando({ title, titleClassName, children, ...props }) {
    return (
      <div data-testid="expando" {...props}>
        <button
          type="button"
          data-testid="expando-title"
          className={titleClassName}
        >
          {title}
        </button>
        <div data-testid="expando-content">{children}</div>
      </div>
    )
  }
})

describe('MarkdownCheatsheet', () => {
  it('should render with default title', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByTestId('expando-title')).toHaveTextContent(
      'Markdown Cheat Sheet'
    )
  })

  it('should apply custom className to title', () => {
    render(<MarkdownCheatsheet className="custom-class" />)

    const title = screen.getByTestId('expando-title')

    expect(title).toHaveClass('default-link')
    expect(title).toHaveClass('text-sm')
    expect(title).toHaveClass('custom-class')
  })

  it('should render markdown syntax table', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('Element')).toBeInTheDocument()
    expect(screen.getByText('Markdown Syntax')).toBeInTheDocument()
  })

  it('should display heading syntax', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('# H1')).toBeInTheDocument()
    expect(screen.getByText('## H2')).toBeInTheDocument()
    expect(screen.getByText('### H3')).toBeInTheDocument()
  })

  it('should display bold syntax', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('**bold text**')).toBeInTheDocument()
  })

  it('should display italic syntax', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('*italicized text*')).toBeInTheDocument()
  })

  it('should display blockquote syntax', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('> blockquote')).toBeInTheDocument()
  })

  it('should display ordered list syntax', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content')

    expect(content.textContent).toContain('1. First item')
    expect(content.textContent).toContain('2. Second item')
    expect(content.textContent).toContain('3. Third item')
  })

  it('should display unordered list syntax', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content')

    expect(content.textContent).toContain('- First item')
  })

  it('should display code syntax', () => {
    render(<MarkdownCheatsheet />)

    expect(screen.getByText('`code`')).toBeInTheDocument()
  })

  it('should display link syntax', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content')

    expect(content.textContent).toContain('[Link Text](https://image/url)')
  })

  it('should display image syntax', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content')

    expect(content.textContent).toContain('![Image Text](https://image/url)')
  })

  it('should pass through additional props', () => {
    render(<MarkdownCheatsheet data-custom="value" id="cheatsheet" />)

    const expando = screen.getByTestId('expando')

    expect(expando).toHaveAttribute('data-custom', 'value')
    expect(expando).toHaveAttribute('id', 'cheatsheet')
  })

  it('should have prose styling for content', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content')
    const proseDiv = content.querySelector('.content-prose')

    expect(proseDiv).toBeInTheDocument()
    expect(proseDiv).toHaveClass('prose-code:before:content-none')
    expect(proseDiv).toHaveClass('prose-code:after:content-none')
  })

  it('should render table with proper structure', () => {
    render(<MarkdownCheatsheet />)

    const table = screen.getByRole('table')

    expect(table).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')

    expect(headers).toHaveLength(2)

    const rows = screen.getAllByRole('row')

    expect(rows.length).toBeGreaterThan(2) // Header + multiple content rows
  })

  it('should use monospace font for syntax examples', () => {
    render(<MarkdownCheatsheet />)

    const codeCell = screen.getByText('# H1').closest('td')

    expect(codeCell).toHaveClass('font-mono')
  })

  it('should handle markdownStyles prop', () => {
    render(<MarkdownCheatsheet markdownStyles={['style1', 'style2']} />)

    // markdownStyles is passed but not directly used in current implementation
    expect(screen.getByTestId('expando')).toBeInTheDocument()
  })

  it('should not break with empty className', () => {
    render(<MarkdownCheatsheet className="" />)

    const title = screen.getByTestId('expando-title')

    expect(title).toHaveClass('default-link')
    expect(title).toHaveClass('text-sm')
  })

  it('should contain all essential markdown elements', () => {
    render(<MarkdownCheatsheet />)

    const content = screen.getByTestId('expando-content').textContent

    // Verify all major markdown elements are documented
    expect(content).toContain('Heading')
    expect(content).toContain('Bold')
    expect(content).toContain('Italic')
    expect(content).toContain('Blockquote')
    expect(content).toContain('Ordered List')
    expect(content).toContain('Code')
    expect(content).toContain('Link')
    expect(content).toContain('Image')
  })
})
