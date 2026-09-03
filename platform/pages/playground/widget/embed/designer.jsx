import { useEffect, useState } from 'react'

import { getExamplesWithExportedThemes } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'
import { buildTheme, themes as builtinThemes, parseTheme } from '@/lib/theme'

import ThemeDesigner from '@/components/ThemeDesigner'

import usePostMessageHandler from '@/hooks/usePostMessageHandler'

export default function Index({ debug, defaultTheme, themes }) {
  const [config, setConfig] = useState({})

  useEffect(() => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`sending ready event`)
    }

    window.parent?.postMessage?.({ type: 'ready', params: {} }, '*')
  }, [debug])

  usePostMessageHandler(
    'setConfig',
    ({ config }) => {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`received setConfig event`, config)
      }

      setConfig(config)
    },
    [debug]
  )

  useEffect(() => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`sending setConfig event`, config)
    }

    window.parent?.postMessage?.({ type: 'setConfig', params: { config } }, '*')
  }, [debug, config])

  const [theme, setTheme] = useState(defaultTheme)

  usePostMessageHandler(
    'setTheme',
    ({ theme }) => {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`received setTheme event`, theme)
      }

      setTheme(theme)
    },
    [debug]
  )

  useEffect(() => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`sending setTheme event`, theme)
    }

    window.parent?.postMessage?.({ type: 'setTheme', params: { theme } }, '*')
  }, [debug, theme])

  return (
    <ThemeDesigner
      className="w-screen h-screen rounded-xl border border-gray-200 dark:border-gray-800"
      theme={theme}
      setTheme={setTheme}
      defaultThemes={themes}
      poweredBy={false}
      fullscreenToggle={false}
      {...config}
    />
  )
}

export async function getServerSideProps(context) {
  let defaultTheme = 'default'

  const themes = [].concat(
    Object.entries(builtinThemes).map(([name, config]) =>
      buildTheme(name, config)
    ),

    getExamplesWithExportedThemes().map(({ title, theme }) => {
      let build

      if (typeof theme === 'string') {
        build = buildTheme(parseTheme(theme), { name: title })
      } else {
        build = buildTheme(theme.name, { ...theme.config, name: title })

        if (title === 'AI Answers') {
          defaultTheme = build
        }
      }

      return build
    })
  )

  return {
    props: makeJsonSafe({
      debug: context.query?.debug === 'true',

      defaultTheme: context.query?.theme || defaultTheme,

      themes: themes,
    }),
  }
}
