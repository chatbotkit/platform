import Head from 'next/head'

import { getExampleBySlug } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'

import WidgetPreview from '@/components/WidgetPreview'

/**
 * Embeddable, non-interactive widget preview for a catalogue example -
 * pixel-perfect themed demo conversations rendered by the real widget UI.
 * The static sibling of ./frame.jsx (the LIVE example widget, which creates a
 * real conversation per render and is deliberately not embeddable).
 *
 * Exists so external surfaces (a marketing site, docs, partner pages) can
 * show widget theme showcases via a plain iframe instead of re-implementing
 * the widget chrome. Framing from any origin is explicitly allowed by the
 * /examples/.+?/preview entry in EMBEDDABLE_PATHS
 * (lib/security.headers.js) - safe because the page is static themed
 * markup: no session, no conversation, no backend cost.
 */
export default function Page({ example }) {
  if (!example) {
    return null
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      {/* @note transparent so the embedding page's backdrop (e.g. the
          pt-rectangles pattern on the widgets landing) shows through */}
      <style jsx global>{`
        html,
        body {
          background: transparent !important;
        }
      `}</style>
      {/* @note no internal width clamp - the embedder sizes the iframe, and
          any leftover gutter would show the embedder's backdrop through the
          transparent page, reading as a phantom second background */}
      <div className="h-screen w-full flex items-start justify-center">
        <WidgetPreview
          className="w-full h-full"
          title={example.title}
          intro={example.intro}
          initial={example.initial}
          banner={example.banner}
          messages={example.messages}
          theme={example.theme}
          poweredBy={false}
        />
      </div>
    </>
  )
}

export async function getServerSideProps(context) {
  const slug = context.params.slug

  const example = slug ? getExampleBySlug(String(slug)) : null

  if (!example || !example.theme) {
    return {
      notFound: true,
    }
  }

  const { title, description, intro, messages, widget, theme } = example

  context.res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400'
  )

  return {
    props: makeJsonSafe({
      example: {
        slug: example.slug,

        title,
        description,

        intro,

        ...widget,

        messages,

        theme: theme.config,
      },
    }),
  }
}
