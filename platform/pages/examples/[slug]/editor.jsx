import { useEffect, useRef, useState } from 'react'

import { getExampleBySlug } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'

import DotsLoader from '@/components/DotsLoader'
import NoSsr from '@/components/NoSsr'
import Theme from '@/components/Theme'

import useTheme from '@/hooks/useTheme'

function ExampleEditor({ example }) {
  const { resolvedTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState(false)

  const warmedUpRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // @note StackBlitz's WebContainer can hang on "Cloning repo from GitHub" on a
  // fresh embed (the service worker isn't controlling the page yet, and only one
  // WebContainer can boot per tab so a not-yet-torn-down previous embed blocks
  // the next one). This recurs on every client-side navigation, so we force a
  // single reload once the first attempt has loaded - by then the SW is
  // registered and the previous WebContainer has had time to tear down, so the
  // retry boots cleanly. The ref guards against an infinite reload loop, and it
  // resets on each mount (navigating to another example remounts this page).

  function handleLoad() {
    if (warmedUpRef.current) {
      setVisible(true)

      return
    }

    warmedUpRef.current = true

    setVisible(false)

    setTimeout(() => setAttempt((n) => n + 1), 100)
  }

  // @note wait until the theme has resolved before mounting the iframe.
  // next-themes returns undefined on the first render and resolves after
  // mount, which would otherwise change the src string and remount the iframe,
  // restarting the StackBlitz clone/boot mid-flight (blank editor on first load)

  if (!mounted) {
    return null
  }

  // @note converts github url to stackblitz embed url for interactive code editing

  const baseUrl = example.url?.replace(
    'https://github.com/',
    'https://stackblitz.com/github/'
  )

  const params = new URLSearchParams({
    embed: '1',
    theme: resolvedTheme === 'dark' ? 'dark' : 'light',
    view: 'editor',
    file: 'README.md',
    showSidebar: '1',
  })

  const stackBlitzUrl = `${baseUrl}?${params.toString()}`

  return (
    <div className="relative w-screen h-screen">
      {!visible && (
        <DotsLoader className="absolute inset-0 items-center justify-center" />
      )}
      <iframe
        key={attempt}
        className={`w-screen h-screen transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        src={stackBlitzUrl}
        onLoad={handleLoad}
        allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; cross-origin-isolated"
      />
    </div>
  )
}

export default function Page({ example }) {
  return (
    <Theme>
      <ExampleEditor example={example} />
    </Theme>
  )
}

Page.getLayout = function (children) {
  return <NoSsr>{children}</NoSsr>
}

export async function getServerSideProps(context) {
  const example = getExampleBySlug(context.params.slug)

  if (!example) {
    return {
      notFound: true,
    }
  }

  if (!example.url) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe(
      {
        example: {
          slug: example.slug,
          url: example.url,
        },
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
