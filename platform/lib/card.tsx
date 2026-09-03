// @ts-ignore because there are no types
import inter400 from '@/public/fonts/inter/400.ttf'
// @ts-ignore because there are no types
import inter700 from '@/public/fonts/inter/700.ttf'
// @ts-ignore because there are no types
import inter900 from '@/public/fonts/inter/900.ttf'

import type { ReactElement } from 'react'

import { siteUrl } from '@/config/site'

import { encode as encodeB64 } from '@/lib/b64'
import { getEmojiCodePoint } from '@/lib/emoji'
import fetch from '@/lib/fetch'
import { generateImage } from '@/lib/satori'

/**
 * Generates a 1200x630 PNG card image from a React element using satori for SVG
 * rendering and resvg for PNG conversion. Supports Inter font (weights 400,
 * 700, and 900) and Twitter emoji assets.
 *
 * @param element - The React element to render as a card
 * @returns The generated card as a PNG image buffer, or null if generation fails
 */
export async function generateCard(
  element: ReactElement
): Promise<Uint8Array | null> {
  const image = await generateImage(element, {
    width: 1200,
    height: 630,

    fonts: [
      {
        name: 'Inter',
        data: new Uint8Array(inter400.data).buffer as ArrayBuffer,
        weight: 400,
      },
      {
        name: 'Inter',
        data: new Uint8Array(inter700.data).buffer as ArrayBuffer,
        weight: 700,
      },
      {
        name: 'Inter',
        data: new Uint8Array(inter900.data).buffer as ArrayBuffer,
        weight: 900,
      },
    ],

    loadAdditionalAsset: async (
      code: string,
      segment: string
    ): Promise<string | []> => {
      if (code === 'emoji') {
        const codePoint = getEmojiCodePoint(segment)

        const response = await fetch(
          `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoint
            .toString(16)
            .toLowerCase()}.svg`
        )

        const source = await response.text()

        return `data:image/svg+xml;base64,${encodeB64(source)}`
      }

      return []
    },
  })

  return image
}

interface ContentCardOptions {
  category: string
  title: string
}

/**
 * Generates a branded content card with the CBK logo lockup, category label,
 * and title text. Monochrome layout with a hairline footer - no colour accents.
 *
 * @param options - The content card options
 * @param options.category - The category label displayed above the title
 * @param options.title - The main title text
 * @returns The generated card as a PNG image buffer, or null if generation fails
 */
export async function generateContentCard({
  category,
  title,
}: ContentCardOptions): Promise<Uint8Array | null> {
  const image = await generateCard(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'white',
        color: 'black',
        fontFamily: '"Inter"',
        padding: 80,
      }}
    >
      {/* brand lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: -0.75,
          color: '#0a0a0a',
        }}
      >
        <img
          src={`${siteUrl}/icon.svg`}
          width={28}
          height={28}
          alt="Logo"
        />
        <div>ChatBotKit</div>
      </div>

      {/* content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            color: '#71717a',
            textTransform: 'uppercase',
          }}
        >
          {category}
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: -2.4,
            marginTop: 20,
            lineHeight: 1,
            color: '#0a0a0a',
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )

  return image
}
