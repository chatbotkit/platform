import { useEffect, useState } from 'react'

import demosData from '@/data/demos.yaml'

import { makeJsonSafe } from '@/lib/struct'

import WidgetPreview from '@/components/WidgetPreview'

import usePostMessageHandler from '@/hooks/usePostMessageHandler'

export default function Index({ debug, defaultTheme, defaultDemo }) {
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
    <div className="p-5 w-screen h-screen flex flex-row justify-center items-center">
      <WidgetPreview
        className="w-full max-w-lg"
        theme={theme}
        setTheme={setTheme}
        poweredBy={false}
        {...defaultDemo}
        {...config}
      />
    </div>
  )
}

export async function getServerSideProps(context) {
  const defaultTheme = 'default'

  const defaultDemo = 'default'

  return {
    props: makeJsonSafe({
      debug: context.query?.debug === 'true',

      defaultTheme: context.query?.theme || defaultTheme,

      defaultDemo: demosData[context.query?.demo || defaultDemo],
    }),
  }
}
