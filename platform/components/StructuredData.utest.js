import StructuredData from './StructuredData'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('next/head', () => {
  return function Head({ children }) {
    return <div data-testid="head">{children}</div>
  }
})

jest.mock('next/image', () => {
  return function Image({ src, alt, ...props }) {
    return <img src={src} alt={alt} {...props} />
  }
})

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn() },
  })),
}))

describe('StructuredData', () => {
  describe('basic functionality', () => {
    it('should render structured data script tag', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Test Org',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script).toBeInTheDocument()
    })

    it('should serialize data as JSON', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'John Doe',
        jobTitle: 'Developer',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script.innerHTML).toBe(JSON.stringify(data))
    })

    it('should handle nested objects', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Widget',
        offers: {
          '@type': 'Offer',
          price: '99.99',
          priceCurrency: 'USD',
        },
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script.innerHTML).toBe(JSON.stringify(data))
    })
  })

  describe('data types', () => {
    it('should handle Organization schema', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Test Company',
        url: 'https://example.com',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed['@type']).toBe('Organization')
      expect(parsed.name).toBe('Test Company')
    })

    it('should handle Article schema', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Test Article',
        author: 'John Doe',
        datePublished: '2024-01-01',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed['@type']).toBe('Article')
      expect(parsed.headline).toBe('Test Article')
    })

    it('should handle BreadcrumbList schema', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://example.com',
          },
        ],
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed['@type']).toBe('BreadcrumbList')
      expect(parsed.itemListElement).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const data = {}

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script.innerHTML).toBe('{}')
    })

    it('should handle arrays', () => {
      const data = [
        { '@type': 'Person', name: 'Alice' },
        { '@type': 'Person', name: 'Bob' },
      ]

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script.innerHTML).toBe(JSON.stringify(data))
    })

    it('should escape angle brackets and ampersands so they cannot break out of the <script>', () => {
      const data = {
        '@type': 'Article',
        headline: 'Test "quoted" & <special> characters',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      // @note `<`, `>` and `&` must be emitted as \uXXXX escapes, never raw
      expect(script.innerHTML).toContain(
        'Test \\"quoted\\" \\u0026 \\u003cspecial\\u003e characters'
      )
      expect(script.innerHTML).not.toContain('<special>')

      // @note the escapes are transparent to any JSON parser: the value
      // round-trips to the exact original string
      expect(JSON.parse(script.innerHTML).headline).toBe(
        'Test "quoted" & <special> characters'
      )
    })

    it('should handle null values', () => {
      const data = {
        '@type': 'Person',
        name: 'John',
        jobTitle: null,
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed.jobTitle).toBeNull()
    })

    it('should handle undefined values', () => {
      const data = {
        '@type': 'Person',
        name: 'John',
        jobTitle: undefined,
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed.jobTitle).toBeUndefined()
    })
  })

  describe('rendering', () => {
    it('should render inside Head component', () => {
      const data = { '@type': 'Organization', name: 'Test' }

      const { getByTestId } = render(<StructuredData data={data} />)

      expect(getByTestId('head')).toBeInTheDocument()
    })

    it('should update when data changes', () => {
      const data1 = { '@type': 'Person', name: 'Alice' }
      const data2 = { '@type': 'Person', name: 'Bob' }

      const { container, rerender } = render(<StructuredData data={data1} />)

      let script = container.querySelector('script[type="application/ld+json"]')

      expect(script.innerHTML).toContain('Alice')

      rerender(<StructuredData data={data2} />)

      script = container.querySelector('script[type="application/ld+json"]')
      expect(script.innerHTML).toContain('Bob')
    })
  })

  // @note regression coverage for user-generated
  // content (e.g. a conversation transcript) rendered into JSON-LD could
  // contain `</script>`, which terminated the inline script, displaced Next's
  // `next-head-count` meta out of <head>, and crashed the client head-manager
  // with "Cannot read properties of null (reading 'content')". It was also a
  // stored-XSS vector.
  describe('script break-out safety', () => {
    it('should not emit a literal </script> when data contains one', () => {
      const data = {
        '@type': 'DiscussionForumPosting',
        text: 'Paste this before the </script> tag: </script><img src=x onerror=alert(1)>',
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      // @note nothing that the HTML parser could read as the end of the
      // element (or as new markup) may appear verbatim
      expect(script.innerHTML).not.toContain('</script>')
      expect(script.innerHTML).not.toContain('</script')
      expect(script.innerHTML).not.toContain('<img')
      expect(script.innerHTML).not.toContain('<')

      // @note but the payload still parses back to the original text
      expect(JSON.parse(script.innerHTML).text).toBe(data.text)
    })

    it('should escape HTML comment openers', () => {
      const data = { '@type': 'Thing', name: 'before <!-- comment --> after' }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )

      expect(script.innerHTML).not.toContain('<!--')
      expect(JSON.parse(script.innerHTML).name).toBe(data.name)
    })
  })

  describe('complex structured data', () => {
    it('should handle FAQPage schema', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is this?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'This is a test',
            },
          },
        ],
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed['@type']).toBe('FAQPage')
      expect(parsed.mainEntity).toHaveLength(1)
      expect(parsed.mainEntity[0]['@type']).toBe('Question')
    })

    it('should handle Product with aggregateRating', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Test Product',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          reviewCount: '100',
        },
      }

      const { container } = render(<StructuredData data={data} />)

      const script = container.querySelector(
        'script[type="application/ld+json"]'
      )
      const parsed = JSON.parse(script.innerHTML)

      expect(parsed.aggregateRating['@type']).toBe('AggregateRating')
      expect(parsed.aggregateRating.ratingValue).toBe('4.5')
    })
  })
})
