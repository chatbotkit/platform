import { siteUrl } from '@/config/site'

import {
  getAppConfigByHostname,
  getAppConfigBySlug,
  getAppSlugByHostname,
  getAppTypeByHostname,
  isAppHostname,
  isAppPathname,
  isAppUrl,
} from '@/lib/app.helpers'

describe('isAppHostname', () => {
  it.each([
    ['example.com', false],
    ['chatbotkit.com', false],
    ['notapp.chatbotkit.com', false],
    // @note the chat shell host was retired - chat.chatbotkit.com is now an
    // ordinary unknown hostname, while chat.chatbotkit.app remains the
    // builtin `chat` app under the standalone app apex
    ['chat.chatbotkit.com', false],
    ['chat.chatbotkit.app', true],
    ['apps.chatbotkit.com', true],
    ['test123.chatbotkit.app', true],
    ['test123.chatbotkit.agency', true],
    [siteUrl, false],
  ])('validates domain %s correctly', (domain, expected) => {
    expect(isAppHostname(domain)).toBe(expected)
  })

  it('should handle hostname object input', () => {
    expect(isAppHostname({ hostname: 'chat.chatbotkit.app' })).toBe(true)
    expect(isAppHostname({ hostname: 'example.com' })).toBe(false)
  })

  it('should handle subdomain matching correctly', () => {
    expect(isAppHostname('sub.chat.chatbotkit.app')).toBe(true)
    expect(isAppHostname('deep.sub.apps.chatbotkit.com')).toBe(true)
  })

  it('should handle null input gracefully', () => {
    expect(isAppHostname(null)).toBe(false)
  })

  it('should handle undefined input gracefully', () => {
    expect(isAppHostname(undefined)).toBe(false)
  })

  it('should handle non-string inputs gracefully', () => {
    expect(isAppHostname(123)).toBe(false)
    expect(isAppHostname(true)).toBe(false)
    expect(isAppHostname([])).toBe(false)
    expect(isAppHostname({})).toBe(false)
  })

  it('should handle empty string input', () => {
    expect(isAppHostname('')).toBe(false)
  })

  it('should handle object with null hostname property', () => {
    expect(isAppHostname({ hostname: null })).toBe(false)
  })
})

describe('isAppPathname', () => {
  it('should identify app pathnames correctly', () => {
    expect(isAppPathname('/apps/chat')).toBe(true)
    expect(isAppPathname('/apps/task')).toBe(true)
    expect(isAppPathname('/apps/connect')).toBe(true)
  })

  it('should reject non-app pathnames', () => {
    expect(isAppPathname('/home')).toBe(false)
    expect(isAppPathname('/about')).toBe(false)
    expect(isAppPathname('/')).toBe(false)
    expect(isAppPathname('/contact')).toBe(false)
  })

  it('should handle pathname object input', () => {
    expect(isAppPathname({ pathname: '/apps/chat' })).toBe(true)
    expect(isAppPathname({ pathname: '/home' })).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(isAppPathname('')).toBe(false)
    expect(isAppPathname('/apps')).toBe(false) // incomplete path
  })

  it('should handle null and undefined gracefully', () => {
    expect(isAppPathname(null)).toBe(false)
    expect(isAppPathname(undefined)).toBe(false)
  })
})

describe('isAppUrl', () => {
  it('should identify app URLs by hostname', () => {
    expect(isAppUrl('https://chat.chatbotkit.app')).toBe(true)
    expect(isAppUrl('https://apps.chatbotkit.com')).toBe(true)
  })

  it('should identify app URLs by pathname', () => {
    expect(isAppUrl('https://chatbotkit.com/apps/chat')).toBe(true)
    expect(isAppUrl('https://chatbotkit.com/apps/task')).toBe(true)
  })

  it('should reject non-app URLs', () => {
    expect(isAppUrl('https://chatbotkit.com/home')).toBe(false)
    expect(isAppUrl('https://example.com')).toBe(false)
    expect(isAppUrl('https://chatbotkit.com/')).toBe(false)
  })

  it('should handle URL objects', () => {
    expect(isAppUrl(new URL('https://chat.chatbotkit.app'))).toBe(true)
    expect(isAppUrl(new URL('https://example.com'))).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(isAppUrl('')).toBe(false)
    expect(isAppUrl('invalid-url')).toBe(false)
  })
})

describe('getAppSlugByHostname', () => {
  it('should return correct slug for known hostnames', () => {
    expect(getAppSlugByHostname('chat.chatbotkit.app')).toBe('chat')
    expect(getAppSlugByHostname('apps.chatbotkit.com')).toBe(':main')
    expect(getAppSlugByHostname('task.chatbotkit.app')).toBe('task')
  })

  it('should return null for unknown hostnames', () => {
    expect(getAppSlugByHostname('example.com')).toBe(null)
    expect(getAppSlugByHostname('chatbotkit.com')).toBe(null)
    expect(getAppSlugByHostname('unknown.chatbotkit.com')).toBe(null)
  })

  it('should handle hostname object input', () => {
    expect(getAppSlugByHostname({ hostname: 'chat.chatbotkit.app' })).toBe(
      'chat'
    )
    expect(getAppSlugByHostname({ hostname: 'example.com' })).toBe(null)
  })

  it('should handle subdomain matching', () => {
    expect(getAppSlugByHostname('sub.chat.chatbotkit.app')).toBe('chat')
    expect(getAppSlugByHostname('deep.sub.apps.chatbotkit.app')).toBe(
      ':builtin'
    )
  })

  it('should handle null input gracefully', () => {
    expect(getAppSlugByHostname(null)).toBe(null)
  })

  it('should handle undefined input gracefully', () => {
    expect(getAppSlugByHostname(undefined)).toBe(null)
  })

  it('should handle non-string inputs gracefully', () => {
    expect(getAppSlugByHostname(123)).toBe(null)
    expect(getAppSlugByHostname(true)).toBe(null)
    expect(getAppSlugByHostname([])).toBe(null)
    expect(getAppSlugByHostname({})).toBe(null)
  })

  it('should handle empty string input', () => {
    expect(getAppSlugByHostname('')).toBe(null)
  })
})

describe('getAppTypeByHostname', () => {
  it('should return correct type for main app', () => {
    expect(getAppTypeByHostname('apps.chatbotkit.com')).toBe(':main')
  })

  it('should return builtin for regular apps', () => {
    expect(getAppTypeByHostname('chat.chatbotkit.app')).toBe(':builtin')
    expect(getAppTypeByHostname('task.chatbotkit.app')).toBe(':builtin')
  })

  it('should return builtin for unknown hostnames', () => {
    expect(getAppTypeByHostname('example.com')).toBe(':custom')
    expect(getAppTypeByHostname('chatbotkit.com')).toBe(':custom')
  })

  it('should handle hostname object input', () => {
    expect(getAppTypeByHostname({ hostname: 'apps.chatbotkit.com' })).toBe(
      ':main'
    )
    expect(getAppTypeByHostname({ hostname: 'chat.chatbotkit.app' })).toBe(
      ':builtin'
    )
  })

  it('should handle edge cases', () => {
    expect(getAppTypeByHostname('')).toBe(':unknown')
  })
})

describe('getAppConfigByHostname', () => {
  it('should return config for apps with configuration', () => {
    const config = getAppConfigByHostname('chat.chatbotkit.app')

    expect(config).toEqual({
      models: true,
      sources: {
        datasets: true,
        skillsets: true,
        spaces: true,
        mcps: true,
      },
      save: true,
      layout: {
        sidebar: {
          icon: '/icon.png;/icon.png#filter=invertGrayscale',
        },
      },
    })
  })

  it('should return null for apps without specific configuration', () => {
    expect(getAppConfigByHostname('apps.chatbotkit.com')).not.toBe(null)
  })

  it('should return null for unknown hostnames', () => {
    expect(getAppConfigByHostname('example.com')).toBe(null)
    expect(getAppConfigByHostname('chatbotkit.com')).toBe(null)
  })

  it('should handle task app with empty config', () => {
    // task app exists but has empty config object
    const config = getAppConfigByHostname('task.chatbotkit.app')

    expect(config).toEqual({})
  })

  it('should handle edge cases', () => {
    expect(getAppConfigByHostname('')).toBe(null)
    expect(getAppConfigByHostname(null)).toBe(null)
    expect(getAppConfigByHostname(undefined)).toBe(null)
  })
})

describe('getAppConfigBySlug', () => {
  it('returns null for non-existing app slug', () => {
    expect(getAppConfigBySlug('non-existing-app')).toBeNull()
  })

  it('returns app config for existing app slug', () => {
    expect(getAppConfigBySlug('chat')).not.toBeNull()
  })

  it('should return correct config for chat app', () => {
    const config = getAppConfigBySlug('chat')

    expect(config).toEqual({
      models: true,
      sources: {
        datasets: true,
        skillsets: true,
        spaces: true,
        mcps: true,
      },
      save: true,
      layout: {
        sidebar: {
          icon: '/icon.png;/icon.png#filter=invertGrayscale',
        },
      },
    })
  })

  it('should return empty config for task app', () => {
    expect(getAppConfigBySlug('task')).toEqual({})
  })

  it('should handle edge cases', () => {
    expect(getAppConfigBySlug('')).toBe(null)
    expect(getAppConfigBySlug(null)).toBe(null)
    expect(getAppConfigBySlug(undefined)).toBe(null)
  })

  it('should be case sensitive', () => {
    expect(getAppConfigBySlug('CHAT')).toBe(null)
    expect(getAppConfigBySlug('Chat')).toBe(null)
  })
})
