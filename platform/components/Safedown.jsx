import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'

import { isURL } from '@/lib/url'

import CodeBlock from '@/components/CodeBlock'
import Component from '@/components/Component'
import ImageBlock from '@/components/ImageBlock'
import Link from '@/components/Link'
import SilencingErrorBoundary from '@/components/SilencingErrorBoundary'

import clsx from 'clsx'
import remarkGfm from 'remark-gfm'

export function SafedownImageBlock({ className, ...props }) {
  return <ImageBlock {...props} className={clsx('not-prose p-0', className)} />
}

export function SafedownCodeBlock({ className, ...props }) {
  return <CodeBlock {...props} className={clsx('not-prose p-0', className)} />
}

export function getComponents({ codeRenderers }) {
  return {
    a({ href, children }) {
      return (
        <Link
          className="default-link"
          href={href}
          target={isURL(href) ? '_blank' : undefined}
          rel="noreferrer"
        >
          {children}
        </Link>
      )
    },

    img({ src, alt }) {
      return <SafedownImageBlock src={src} alt={alt} />
    },

    code({ inline, className, children }) {
      // @note the capture must span the whole fence info string (e.g.
      // `file:path/to/name.lua`), not just word characters, otherwise the
      // renderer-specific payload after `:` or `/` never reaches the renderer
      const [, language = ''] = /language-(\S+)/.exec(className || '') || []

      const source = String(children)

      if (!source) {
        return null
      }

      return !inline ? (
        <Component
          as={
            codeRenderers?.[
              language
                ?.split(/\/|:/)
                ?.map((s) => s.trim())
                ?.filter(Boolean)[0] || 'default'
            ] || SafedownCodeBlock
          }
          language={language}
        >
          {source}
        </Component>
      ) : (
        <code>{children}</code>
      )
    },

    pre({ children, node }) {
      if (node?.children?.[0]?.tagName === 'code') {
        return children
      } else {
        return <pre>{children}</pre>
      }
    },

    table({ children }) {
      return <table>{children}</table>
    },

    // @todo add custom directives https://github.com/IGassmann/remark-directive-rehype
  }
}

/**
 * A component specifically designed to render markdown content in a safe way.
 */
export default function Safedown({
  source,

  children = source,

  codeRenderers: _codeRenderers,

  components: _components,
  extraComponents: _extraComponents,

  remarkPlugins: _remarkPlugins,
  extraRemarkPlugins: _extraRemarkPlugins,

  rehypePlugins: _rehypePlugins,
  extraRehypePlugins: _extraRehypePlugins,

  ...props
}) {
  const components = useMemo(() => {
    return {
      ...(_components ||
        getComponents({
          codeRenderers: _codeRenderers,
        })),

      ..._extraComponents,
    }
  }, [_components, _extraComponents, _codeRenderers])

  const remarkPlugins = useMemo(() => {
    return (_remarkPlugins || [remarkGfm]).concat(_extraRemarkPlugins || [])
  }, [_remarkPlugins, _extraRemarkPlugins])

  const rehypePlugins = useMemo(() => {
    return (_rehypePlugins || []).concat(_extraRehypePlugins || [])
  }, [_rehypePlugins, _extraRehypePlugins])

  return (
    <SilencingErrorBoundary>
      <ReactMarkdown
        {...props}
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        skipHtml={true}
      >
        {children}
      </ReactMarkdown>
    </SilencingErrorBoundary>
  )
}
