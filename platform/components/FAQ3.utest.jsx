import FAQ3 from './FAQ3'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/FAQ', () => ({
  Content: ({ faq }) => (
    <div data-testid="faq-content">
      {faq.map((item, i) => (
        <div key={i}>
          {item.question} - {item.answer}
        </div>
      ))}
    </div>
  ),
}))

jest.mock(
  '@/components/FAQStructuredData',
  () =>
    function FAQStructuredData() {
      return <div data-testid="structured-data" />
    }
)

describe('FAQ3', () => {
  const mockFAQ = [
    { question: 'Question 1?', answer: 'Answer 1' },
    { question: 'Question 2?', answer: 'Answer 2' },
  ]

  describe('basic rendering', () => {
    it('should render with default title', () => {
      render(<FAQ3 faq={mockFAQ} />)
      expect(screen.getByText('FAQ')).toBeInTheDocument()
    })

    it('should render structured data', () => {
      render(<FAQ3 faq={mockFAQ} />)
      expect(screen.getByTestId('structured-data')).toBeInTheDocument()
    })

    it('should render FAQ content', () => {
      render(<FAQ3 faq={mockFAQ} />)
      expect(screen.getByTestId('faq-content')).toBeInTheDocument()
      expect(screen.getByText(/Question 1/)).toBeInTheDocument()
      expect(screen.getByText(/Question 2/)).toBeInTheDocument()
    })
  })

  describe('custom title', () => {
    it('should render custom title', () => {
      render(<FAQ3 faq={mockFAQ} title="Custom FAQ" />)
      expect(screen.getByText('Custom FAQ')).toBeInTheDocument()
      expect(screen.queryByText('FAQ')).not.toBeInTheDocument()
    })

    it('should not render title section when title is empty string', () => {
      render(<FAQ3 faq={mockFAQ} title="" />)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('should not render title section when title is null', () => {
      render(<FAQ3 faq={mockFAQ} title={null} />)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })

  describe('children content', () => {
    it('should render children as subtitle', () => {
      render(
        <FAQ3 faq={mockFAQ}>
          <span>This is a subtitle</span>
        </FAQ3>
      )
      expect(screen.getByText('This is a subtitle')).toBeInTheDocument()
    })

    it('should render both title and children', () => {
      render(
        <FAQ3 faq={mockFAQ} title="Custom Title">
          Subtitle text
        </FAQ3>
      )
      expect(screen.getByText('Custom Title')).toBeInTheDocument()
      expect(screen.getByText('Subtitle text')).toBeInTheDocument()
    })

    it('should render header section when only children provided', () => {
      render(
        <FAQ3 faq={mockFAQ} title="">
          Only subtitle
        </FAQ3>
      )
      expect(screen.getByText('Only subtitle')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty FAQ array', () => {
      render(<FAQ3 faq={[]} />)
      expect(screen.getByTestId('faq-content')).toBeInTheDocument()
    })

    it('should render with minimal props', () => {
      render(<FAQ3 faq={mockFAQ} />)
      expect(screen.getByTestId('structured-data')).toBeInTheDocument()
      expect(screen.getByTestId('faq-content')).toBeInTheDocument()
    })

    it('should handle complex children', () => {
      render(
        <FAQ3 faq={mockFAQ}>
          <div>
            <strong>Bold</strong> and <em>italic</em>
          </div>
        </FAQ3>
      )
      expect(screen.getByText('Bold')).toBeInTheDocument()
      expect(screen.getByText('italic')).toBeInTheDocument()
    })
  })
})
