import Pagedown from './Pagedown'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/components/CodeBlock', () => {
  return function CodeBlock({ children }) {
    return <pre data-testid="code-block">{children}</pre>
  }
})

jest.mock('@/components/BlueprintCodeBlock', () => {
  return function BlueprintCodeBlock({ children }) {
    return (
      <div data-testid="blueprint-code-block">
        <iframe
          className="blueprint"
          src={`#${children}`}
          title="Blueprint Preview"
        />
        <button type="button" aria-label="Copy blueprint" />
      </div>
    )
  }
})

jest.mock('@/components/Diagram', () => {
  return function Diagram({ children }) {
    return <div data-testid="diagram">{children}</div>
  }
})

jest.mock('@/components/Image', () => {
  return function Image({ src, alt }) {
    return <img data-testid="image" src={src} alt={alt} />
  }
})

jest.mock('@/components/Link', () => {
  return function Link({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

describe('Pagedown', () => {
  describe('code blocks', () => {
    it('renders inline code as a plain code element', () => {
      const markdown = 'Use `inline code` here'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const code = container.querySelector('code')

      expect(code).toBeInTheDocument()
      expect(code.textContent).toBe('inline code')
      // @note inline code must not be wrapped in a CodeBlock
      expect(
        container.querySelector('[data-testid="code-block"]')
      ).not.toBeInTheDocument()
    })

    it('renders a fenced code block without language via CodeBlock', () => {
      const markdown = '```\nhello world\n```'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const block = container.querySelector('[data-testid="code-block"]')

      expect(block).toBeInTheDocument()
      expect(block.textContent).toContain('hello world')
    })

    it('renders a fenced code block with language via CodeBlock', () => {
      const markdown = '```javascript\nconst x = 1\n```'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const block = container.querySelector('[data-testid="code-block"]')

      expect(block).toBeInTheDocument()
      expect(block.textContent).toContain('const x = 1')
    })

    it('renders a mermaid code block as a Diagram', () => {
      const markdown = '```mermaid\ngraph TD; A-->B\n```'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      expect(
        container.querySelector('[data-testid="diagram"]')
      ).toBeInTheDocument()
      expect(
        container.querySelector('[data-testid="code-block"]')
      ).not.toBeInTheDocument()
    })

    it('renders a blueprint code block as an iframe', () => {
      const markdown = '```blueprint\n{"nodes":[]}\n```'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const iframe = container.querySelector('iframe.blueprint')

      expect(
        container.querySelector('[data-testid="blueprint-code-block"]')
      ).toBeInTheDocument()
      expect(iframe).toBeInTheDocument()
      expect(
        container.querySelector('[aria-label="Copy blueprint"]')
      ).toBeInTheDocument()
    })
  })

  describe('HTML nesting validity', () => {
    it('should not render block-level elements inside p tags for YouTube embeds', () => {
      // @note YouTube embeds in markdown (![](youtube-url)) get wrapped in <p>
      // by react-markdown. Our img override returns a <div> for YouTube URLs,
      // creating invalid <p><div></div></p> which causes hydration errors.

      const markdown = '![](https://www.youtube.com/watch?v=o07tvIPWEpo)'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      // @note a <div> or <iframe> inside a <p> is invalid HTML nesting
      const paragraphs = container.querySelectorAll('p')

      for (const p of paragraphs) {
        const nestedDivs = p.querySelectorAll('div')
        const nestedIframes = p.querySelectorAll('iframe')

        expect(nestedDivs.length).toBe(0)
        expect(nestedIframes.length).toBe(0)
      }
    })

    it('should not render video elements inside p tags', () => {
      // @note same issue applies to video embeds

      const markdown = '![](/media/tutorials/test-video-id.mp4)'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const paragraphs = container.querySelectorAll('p')

      for (const p of paragraphs) {
        const nestedVideos = p.querySelectorAll('video')

        expect(nestedVideos.length).toBe(0)
      }
    })

    it('should still render YouTube iframe', () => {
      const markdown = '![](https://www.youtube.com/watch?v=o07tvIPWEpo)'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const iframe = container.querySelector('iframe')

      expect(iframe).toBeInTheDocument()
      expect(iframe.src).toContain('youtube')
    })

    it('should render normal images inside p tags', () => {
      const markdown = '![alt text](https://example.com/image.png)'

      const { container } = render(<Pagedown>{markdown}</Pagedown>)

      const img = container.querySelector('img')

      expect(img).toBeInTheDocument()
      expect(img.closest('p')).toBeInTheDocument()
    })
  })
})
