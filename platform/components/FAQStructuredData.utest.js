import FAQStructuredData from './FAQStructuredData'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock(
  './StructuredData',
  () =>
    function StructuredData({ data }) {
      return <script type="application/ld+json">{JSON.stringify(data)}</script>
    }
)

describe('FAQStructuredData', () => {
  describe('basic functionality', () => {
    it('should render StructuredData with FAQ schema', () => {
      const faq = [
        { question: 'What is AI?', answer: 'Artificial Intelligence' },
        { question: 'What is ML?', answer: 'Machine Learning' },
      ]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script).not.toBeNull()

      const data = JSON.parse(script.textContent)

      expect(data['@context']).toBe('https://schema.org')
      expect(data['@type']).toBe('FAQPage')
      expect(data.mainEntity).toHaveLength(2)
    })

    it('should format questions correctly', () => {
      const faq = [{ question: 'Test question?', answer: 'Test answer' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0]['@type']).toBe('Question')
      expect(data.mainEntity[0].name).toBe('Test question?')
    })

    it('should format answers correctly', () => {
      const faq = [{ question: 'Test?', answer: 'Answer text' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
      expect(data.mainEntity[0].acceptedAnswer.text).toBe('Answer text')
    })
  })

  describe('multiple FAQ items', () => {
    it('should handle single FAQ item', () => {
      const faq = [{ question: 'Q1', answer: 'A1' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity).toHaveLength(1)
    })

    it('should handle multiple FAQ items', () => {
      const faq = [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
        { question: 'Q3', answer: 'A3' },
      ]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity).toHaveLength(3)
      expect(data.mainEntity[0].name).toBe('Q1')
      expect(data.mainEntity[1].name).toBe('Q2')
      expect(data.mainEntity[2].name).toBe('Q3')
    })

    it('should preserve order of FAQ items', () => {
      const faq = [
        { question: 'First', answer: 'A' },
        { question: 'Second', answer: 'B' },
        { question: 'Third', answer: 'C' },
      ]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity.map((q) => q.name)).toEqual([
        'First',
        'Second',
        'Third',
      ])
    })
  })

  describe('edge cases', () => {
    it('should render null for empty array', () => {
      const { container } = render(<FAQStructuredData faq={[]} />)

      expect(container.firstChild).toBeNull()
    })

    it('should render null for undefined faq', () => {
      const { container } = render(<FAQStructuredData faq={undefined} />)

      expect(container.firstChild).toBeNull()
    })

    it('should render null for null faq', () => {
      const { container } = render(<FAQStructuredData faq={null} />)

      expect(container.firstChild).toBeNull()
    })

    it('should handle empty strings in question/answer', () => {
      const faq = [{ question: '', answer: '' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].name).toBe('')
      expect(data.mainEntity[0].acceptedAnswer.text).toBe('')
    })

    it('should handle long text in questions and answers', () => {
      const longText = 'Lorem ipsum '.repeat(100)
      const faq = [{ question: longText, answer: longText }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].name).toBe(longText)
      expect(data.mainEntity[0].acceptedAnswer.text).toBe(longText)
    })

    it('should handle special characters in questions and answers', () => {
      const faq = [
        { question: 'What\'s "AI"?', answer: 'It\'s <complex> & "powerful"' },
      ]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].name).toBe('What\'s "AI"?')
      expect(data.mainEntity[0].acceptedAnswer.text).toBe(
        'It\'s <complex> & "powerful"'
      )
    })

    it('should handle unicode characters', () => {
      const faq = [{ question: '什么是人工智能？', answer: '人工智能是...' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].name).toBe('什么是人工智能？')
      expect(data.mainEntity[0].acceptedAnswer.text).toBe('人工智能是...')
    })
  })

  describe('schema validation', () => {
    it('should have correct @context', () => {
      const faq = [{ question: 'Q', answer: 'A' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data['@context']).toBe('https://schema.org')
    })

    it('should have FAQPage type', () => {
      const faq = [{ question: 'Q', answer: 'A' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data['@type']).toBe('FAQPage')
    })

    it('should have mainEntity array', () => {
      const faq = [{ question: 'Q', answer: 'A' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(Array.isArray(data.mainEntity)).toBe(true)
    })

    it('should have Question type for each item', () => {
      const faq = [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
      ]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      data.mainEntity.forEach((item) => {
        expect(item['@type']).toBe('Question')
      })
    })

    it('should have Answer type for acceptedAnswer', () => {
      const faq = [{ question: 'Q', answer: 'A' }]

      const { container } = render(<FAQStructuredData faq={faq} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const data = JSON.parse(script.textContent)

      expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    })
  })
})
