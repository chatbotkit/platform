import Safedown, { getComponents } from './Safedown'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import remarkGfm from 'remark-gfm'

const mockReactMarkdown = jest.fn(({ children }) => (
  <div data-testid="markdown">{children}</div>
))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (props) => mockReactMarkdown(props),
}))

jest.mock('@/lib/url', () => ({
  isURL: jest.fn((value) => /^https?:\/\//.test(value || '')),
}))

jest.mock('@/components/CodeBlock', () => ({
  __esModule: true,
  default: ({ children }) => <pre data-testid="code-block">{children}</pre>,
}))

jest.mock('@/components/Component', () => ({
  __esModule: true,
  default: ({ as: As = 'div', children, ...props }) => (
    <As data-testid="polymorphic-component" {...props}>
      {children}
    </As>
  ),
}))

jest.mock('@/components/ImageBlock', () => ({
  __esModule: true,
  default: ({ src, alt }) => (
    <img data-testid="image-block" src={src} alt={alt || ''} />
  ),
}))

jest.mock('@/components/Link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => (
    <a data-testid="link" href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/components/SilencingErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}))

describe('Safedown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders markdown using source as fallback children with default options', () => {
    render(<Safedown source="**hello**" />)

    expect(screen.getByTestId('markdown')).toHaveTextContent('**hello**')
    expect(mockReactMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        skipHtml: true,
        children: '**hello**',
        components: expect.any(Object),
        remarkPlugins: [remarkGfm],
        rehypePlugins: [],
      })
    )
  })

  it('uses explicit children instead of source', () => {
    render(<Safedown source="source text">child text</Safedown>)

    expect(screen.getByTestId('markdown')).toHaveTextContent('child text')
  })

  it('merges custom and extra plugins/components', () => {
    const customComponents = { p: ({ children }) => <p>{children}</p> }
    const extraComponents = { h1: ({ children }) => <h1>{children}</h1> }
    const customRemark = [() => {}]
    const extraRemark = [() => {}]
    const customRehype = [() => {}]
    const extraRehype = [() => {}]

    render(
      <Safedown
        source="hello"
        components={customComponents}
        extraComponents={extraComponents}
        remarkPlugins={customRemark}
        extraRemarkPlugins={extraRemark}
        rehypePlugins={customRehype}
        extraRehypePlugins={extraRehype}
      />
    )

    const props = mockReactMarkdown.mock.calls[0][0]

    expect(props.components).toMatchObject({
      p: customComponents.p,
      h1: extraComponents.h1,
    })
    expect(props.remarkPlugins).toEqual(customRemark.concat(extraRemark))
    expect(props.rehypePlugins).toEqual(customRehype.concat(extraRehype))
  })
})

describe('getComponents', () => {
  it('sets target _blank for external links and leaves internal links unchanged', () => {
    const components = getComponents({})

    render(
      <div>
        {components.a({ href: 'https://example.com', children: 'external' })}
        {components.a({ href: '/docs', children: 'internal' })}
      </div>
    )

    const links = screen.getAllByTestId('link')

    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noreferrer')
    expect(links[1]).not.toHaveAttribute('target')
  })

  it('renders inline code and block code with language-specific renderer', () => {
    const customRenderer = ({ children }) => (
      <div data-testid="custom-renderer">{children}</div>
    )
    const components = getComponents({
      codeRenderers: { javascript: customRenderer },
    })

    render(
      <div>
        {components.code({ inline: true, children: 'x = 1' })}
        {components.code({
          inline: false,
          className: 'language-javascript',
          children: 'const x = 1',
        })}
      </div>
    )

    expect(screen.getByText('x = 1')).toBeInTheDocument()
    expect(screen.getByTestId('custom-renderer')).toHaveTextContent(
      'const x = 1'
    )
  })

  it('passes the full fence info string to renderers keyed by its first segment', () => {
    const fileRenderer = ({ language, children }) => (
      <div data-testid="file-renderer" data-language={language}>
        {children}
      </div>
    )
    const components = getComponents({
      codeRenderers: { file: fileRenderer },
    })

    render(
      components.code({
        inline: false,
        className: 'language-file:ShopClientController.lua',
        children: 'local x = 1',
      })
    )

    const rendered = screen.getByTestId('file-renderer')

    expect(rendered).toHaveTextContent('local x = 1')
    expect(rendered).toHaveAttribute(
      'data-language',
      'file:ShopClientController.lua'
    )
  })
})
