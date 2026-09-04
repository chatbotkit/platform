import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'

import { isYoutubeUrl } from '@/lib/youtube'

import BlueprintCodeBlock from '@/components/BlueprintCodeBlock'
import CodeBlock from '@/components/CodeBlock'
import Diagram from '@/components/Diagram'
import Image from '@/components/Image'
import Link from '@/components/Link'
import YoutubePlayer from '@/components/YoutubePlayer'

import useHostname from '@/hooks/useHostname'

import clsx from 'clsx'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

// @note content assets are static files under /media/<section>/ - the media
// type is carried by the file extension rather than by the URL prefix

const MEDIA_IMAGE_PATTERN = /^\/media\/.+\.(png|jpe?g|gif|webp|svg)$/i
const MEDIA_VIDEO_PATTERN = /^\/media\/.+\.(mp4|webm|mov)$/i

function isAssetImage(src = '') {
  return MEDIA_IMAGE_PATTERN.test(src)
}

function isAssetVideo(src = '') {
  return MEDIA_VIDEO_PATTERN.test(src)
}

export function PagedownCodeBlock({ className, ...props }) {
  return (
    <CodeBlock
      {...props}
      className={clsx('not-prose p-0 text-sm', className)}
    />
  )
}

function getComponents(hostname) {
  return {
    p({ children, node }) {
      // @note when a paragraph contains only an image element whose src is a
      // YouTube URL or video URL, our img override replaces it with a block-level
      // element (div or video). Rendering <div> or <video> inside <p> is invalid
      // HTML and causes hydration mismatches. In those cases
      // we render as a div instead of p to avoid invalid nesting.

      const elements = node?.children?.filter((c) => c.type === 'element') || []

      if (elements.length === 1 && elements[0].tagName === 'img') {
        const src = elements[0].properties?.src || ''

        if (isYoutubeUrl(src) || isAssetVideo(src)) {
          return <div>{children}</div>
        }
      }

      return <p>{children}</p>
    },

    a({ href, children }) {
      const extra = {}

      // @note relative links are internal; absolute links leave the site
      // unless they point at the serving host
      if (href.startsWith('https//') || href.startsWith('https://')) {
        let external = true

        try {
          external = new URL(href).hostname !== hostname
        } catch {
          // pass
        }

        if (external) {
          extra.target = '_blank'
          extra.rel = 'noreferrer'
        }
      }

      return (
        <Link className="default-link" href={href} {...extra}>
          {children}
        </Link>
      )
    },

    img({ src, alt }) {
      switch (true) {
        case isYoutubeUrl(src): {
          return (
            <div key={src} className="video w-full !aspect-[16/9]">
              <YoutubePlayer
                className="w-full !aspect-[16/9]"
                src={src}
                title={alt}
              />
            </div>
          )
        }

        case isAssetImage(src): {
          return (
            <Image
              key={src}
              className="w-full h-auto"
              src={src}
              alt={alt}
              sizes="100vw"
              width={700}
              height={300}
            />
          )
        }

        case isAssetVideo(src): {
          return (
            <video
              key={src}
              className="w-full h-auto"
              preload="metadata"
              autoPlay
              loop
              playsInline
              muted
            >
              <source src={src} />
            </video>
          )
        }

        default: {
          return <img key={src} className="w-full h-auto" src={src} alt={alt} />
        }
      }
    },

    code({ className, children, inline }) {
      if (inline) {
        return <code>{children}</code>
      }

      const [, language] = /language-(\w+)/.exec(className || '') || []

      const source = String(children)

      if (!source) {
        return null
      }

      switch (true) {
        case language === 'mermaid': {
          return <Diagram>{source}</Diagram>
        }

        case language === 'blueprint': {
          return <BlueprintCodeBlock>{source}</BlueprintCodeBlock>
        }

        case !!language: {
          return (
            <PagedownCodeBlock language={language}>{source}</PagedownCodeBlock>
          )
        }

        default: {
          return <PagedownCodeBlock>{source}</PagedownCodeBlock>
        }
      }
    },

    pre({ children, node }) {
      if (node?.children?.[0]?.tagName === 'code') {
        return children
      } else {
        return `<pre>${children}</pre>`
      }
    },

    table({ children }) {
      return (
        <div className="prose dark:prose-invert">
          <table>{children}</table>
        </div>
      )
    },
  }
}

/**
 * A component specifically designed to render markdown content in pages.
 */
export default function Pagedown({
  source,

  children: _children = source,

  components: _components,

  remarkPlugins: _remarkPlugins,
  rehypePlugins: _rehypePlugins,

  ...props
}) {
  const hostname = useHostname()

  const components = useMemo(() => {
    return _components || getComponents(hostname)
  }, [_components, hostname])

  const remarkPlugins = useMemo(() => {
    return _remarkPlugins || [remarkGfm]
  }, [_remarkPlugins])

  const rehypePlugins = useMemo(() => {
    return _rehypePlugins || [rehypeRaw, rehypeSlug]
  }, [_rehypePlugins])

  const children = useMemo(() => {
    return (
      _children
        // @note replace em dash with regular dash
        .replaceAll('\u2014', '-')
    )
  }, [_children])

  return (
    <ReactMarkdown
      {...props}
      components={components}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      skipHtml={false}
    >
      {children}
    </ReactMarkdown>
  )
}
