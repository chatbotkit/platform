import { apps } from '@/config/apps'
import { staticUrl } from '@/config/site'

describe('apps', () => {
  it('resolves built-in banners against the static origin', () => {
    const chat = apps.find(({ slug }) => slug === 'chat')

    expect(chat.banner).toBe(
      new URL('/apps/chat/banner.png', staticUrl).toString()
    )
  })
})
