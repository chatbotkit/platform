import {
  GENERIC_SECRET_ICON,
  resolveSecretDisplayIcon,
  resolveSecretIcon,
  resolveSecretTemplate,
} from '@/lib/secret.icon'

const SECRET_TEMPLATES = [
  {
    template: 'accuweather',
    name: 'AccuWeather',
    icon: '@logo/accuweather.com',
  },
  { template: 'google/mail', name: 'Google Mail', icon: '@logo/google.com' },
]

describe('resolveSecretTemplate', () => {
  it('matches by the template reference some secrets keep in config', () => {
    expect(
      resolveSecretTemplate(
        { name: 'Renamed Weather Key', config: { template: 'accuweather' } },
        SECRET_TEMPLATES
      )
    ).toBe(SECRET_TEMPLATES[0])
  })

  it('matches by the name inherited from the template at creation', () => {
    expect(
      resolveSecretTemplate({ name: 'Google Mail' }, SECRET_TEMPLATES)
    ).toBe(SECRET_TEMPLATES[1])
  })

  it('returns null when nothing matches', () => {
    expect(
      resolveSecretTemplate({ name: 'My Custom Token' }, SECRET_TEMPLATES)
    ).toBeNull()
  })
})

describe('resolveSecretIcon', () => {
  it('resolves a provider icon a name-keyword heuristic would miss', () => {
    // @note the bug: "AccuWeather" is not in nameToIcon, so the connection
    // showed the generic key - the secret template carries the real logo
    expect(resolveSecretIcon({ name: 'AccuWeather' }, SECRET_TEMPLATES)).toBe(
      '@logo/accuweather.com'
    )
  })

  it('returns null when no secret template matches', () => {
    expect(resolveSecretIcon({ name: 'Custom' }, SECRET_TEMPLATES)).toBeNull()
  })
})

describe('resolveSecretDisplayIcon', () => {
  it('prefers the secret template icon', () => {
    expect(
      resolveSecretDisplayIcon({ name: 'AccuWeather' }, SECRET_TEMPLATES)
    ).toBe('@logo/accuweather.com')
  })

  it('falls back to the name-keyword heuristic when no template matches', () => {
    expect(resolveSecretDisplayIcon({ name: 'Slack' }, [])).toBe(
      '@logo/slack.com'
    )
  })

  it('falls back to the generic key when nothing matches', () => {
    expect(resolveSecretDisplayIcon({ name: 'Nondescript Token' }, [])).toBe(
      GENERIC_SECRET_ICON
    )
  })

  // @note connections render on a fixed white tile in both themes, so the icon
  // is not theme-mapped - a monochrome logo must stay dark to read on white
  it('does not theme-map a monochrome brand logo', () => {
    expect(
      resolveSecretDisplayIcon({ name: 'HTTP API Token' }, [
        {
          template: 'bearer',
          name: 'HTTP API Token',
          icon: '@logo/chatbotkit.com',
        },
      ])
    ).toBe('@logo/chatbotkit.com')
  })
})
