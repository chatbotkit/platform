import { useEffect, useRef, useState } from 'react'

import { merge } from '@/lib/object'
import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo from '@/layouts/Demo'

import ColorInput from '@/components/ColorInput'

// source start
import { contrastColor } from 'contrast-color'

const defaultTheme = {
  name: 'default',
  config: {
    version: 'v2',
    popupRounding: '5px',
    popupBorderGradientFrom: '#ec4899',
    popupBorderGradientVia: '#06b6d4',
    popupBorderGradientTo: '#8b5cf6',
    popupBorderSize: '2px',
    barBorderPrimary: 'transparent',
    barPrimary: '#ffffff',
    conversationPrimary: '#ffffff',
    messagesPadding: '10px',
    messageSpacing: '10px',
    messageRounding: '10px',
    botMessagePrimary: '#f1f3f5',
    botMessageText: '#314351',
    botMessagePadding: '20px',
    userMessagePrimary: '#2c4bff',
    userMessageText: '#ffffff',
    userMessagePadding: '20px',
    actionsBorderPrimary: '#d2d2d2',
    actionsPadding: '0px',
    inputBorderPrimary: 'transparent',
    inputBorderSecondary: 'transparent',
    buttonPrimary: '#2c4bff',
    buttonSecondary: '#2c4bff',
    buttonSize: '60px',
    buttonRounding: '25px',
    buttonFeatures: 'hide-on-open',
    fontSize: '14px',
    lineHeight: '20px',
    popoverWidth: '400px',
    popoverHeight: '750px',
    poweredByPadding: '0.5rem',
    messageStyle: 'bubble',
  },
}

function getCustomTheme(color) {
  const brandPrimary = color
  const brandText = contrastColor({ bgColor: brandPrimary })

  return merge(defaultTheme, {
    config: {
      userMessageText: brandText,
      userMessagePrimary: brandPrimary,

      tapText: brandPrimary,

      buttonText: brandText,
      buttonPrimary: brandPrimary,
      buttonSecondary: brandPrimary,

      brandPrimary,
    },
  })
}

export default function Page() {
  const [color, setColor] = useState('#000000')

  const previewRef = useRef(null)

  const preview = previewRef.current

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== preview?.contentWindow) {
        return
      }

      const { type, params } = event.data

      switch (type) {
        case 'ready': {
          preview.contentWindow.postMessage(
            {
              type: 'setConfig',
              params: {
                config: {},
              },
            },
            '*'
          )

          preview.contentWindow.postMessage(
            {
              type: 'setTheme',
              params: {
                theme: getCustomTheme('#000000'),
              },
            },
            '*'
          )

          break
        }

        case 'setTheme': {
          const { theme } = params

          theme // @todo save the theme into chatbotkit or your own database

          break
        }
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [preview])

  useEffect(() => {
    if (!preview) {
      return
    }

    preview.contentWindow.postMessage(
      {
        type: 'setTheme',
        params: {
          theme: getCustomTheme(color),
        },
      },
      '*'
    )
  }, [preview, color])

  return (
    <div className="w-full h-screen flex flex-cols">
      <div className="w-full overflow-auto flex flex-cols justify-center items-center p-20">
        <div id="form" className="space-y-6">
          <ColorInput
            className="default-input"
            value={color}
            setValue={setColor}
          />
          <p className="text-xs">
            Use the color picker to change the primary color of the theme.
          </p>
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden m-10 flex min-w-[30rem] max-w-[60rem]">
        <iframe
          className="flex-1 w-full h-full"
          src="/playground/widget/embed/preview"
          ref={previewRef}
        />
      </div>
    </div>
  )
}
// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Theme Color Builder"
      description="Demonstrates how to create a custom theme builder for your own product."
      slug="theme-color-builder"
      source={source}
      copy={false}
      share={false}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource(
    './pages/examples/theme-color-builder/demo/index.jsx'
  )

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
