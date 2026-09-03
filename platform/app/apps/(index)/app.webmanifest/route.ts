import { headers } from 'next/headers'

import { siteHostname } from '@/config/site'

import { getPublicAppConfig } from '@/lib/app.router.app.config'
import { setupHeadersContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { toKebabCase } from '@/lib/string'

export async function GET(): Promise<Response> {
  return executeInContext(async () => {
    const thisHeaders = await headers()

    setupHeadersContext(thisHeaders)

    const host =
      getContextFrontendHost() || getContextRequestHost() || siteHostname

    const config = await getPublicAppConfig()

    const {
      name = 'ChatBotKit',
      description = 'Discover a range of cutting-edge conversational AI apps, each uniquely designed and powered by the advanced capabilities of the ChatBotKit platform.',
    } = config || {}

    const manifest = {
      id: toKebabCase(host),
      name: name,
      short_name: name,
      description: description,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      start_url: '/',
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    }

    return new Response(JSON.stringify(manifest), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })
}
