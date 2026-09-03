import { metadata } from '@/app/apps/layout'
import { staticUrl } from '@/config/site'

describe('apps metadata', () => {
  it('serves platform icons from the static origin', () => {
    expect(metadata.icons).toEqual({
      icon: [
        {
          url: new URL('/favicon-light.ico', staticUrl).toString(),
          media: '(prefers-color-scheme: light)',
        },
        {
          url: new URL('/favicon-dark.ico', staticUrl).toString(),
          media: '(prefers-color-scheme: dark)',
        },
      ],
      apple: [
        {
          url: new URL('/apple-touch-icon.png', staticUrl).toString(),
          sizes: '180x180',
        },
      ],
    })
  })
})
