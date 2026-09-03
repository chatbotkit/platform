import {
  GENERIC_ABILITY_ICON,
  buildTemplateCatalogue,
  resolveAbilityDisplayIcon,
  resolveAbilityIcon,
  resolveAbilityTemplate,
} from '@/lib/ability.icon'

// @note two catalogue shapes flow through the same resolver: the flat items
// `useAbilityTemplates` returns (keyed by `name`) and the designer's
// `abilityResources` (keyed by `title`). Both are exercised below.

const TEMPLATE_ITEMS = [
  {
    template: 'accuweather/api/call',
    name: 'Call Accuweather API',
    icon: '@logo/accuweather.com',
  },
  {
    template: 'slack/conversation/start[by-id]',
    name: 'Start Slack Conversation',
    icon: '@logo/slack.com',
  },
]

const catalogue = buildTemplateCatalogue(TEMPLATE_ITEMS)

describe('buildTemplateCatalogue', () => {
  it('keys entries by their normalized template id', () => {
    expect(Object.keys(catalogue).sort()).toEqual([
      'accuweather/api/call',
      'slack/conversation/start[by-id]',
    ])
  })

  it('skips entries without a template id', () => {
    expect(buildTemplateCatalogue([{ name: 'orphan' }, null])).toEqual({})
  })

  it('defaults to an empty catalogue', () => {
    expect(buildTemplateCatalogue()).toEqual({})
  })
})

describe('resolveAbilityIcon', () => {
  // @note an ability created from a template embeds its
  // template id in the instruction, so its icon is recoverable even though the
  // ability name ("Search Location" etc.) carries no provider keyword
  it.each([
    ['@accuweather/api/call', '@logo/accuweather.com'],
    ['@slack/conversation/start[by-id]', '@logo/slack.com'],
  ])('resolves %s from the single-line template form', (instruction, icon) => {
    expect(
      resolveAbilityIcon({ name: 'Search Location', instruction }, catalogue)
    ).toBe(icon)
  })

  it('resolves from the callable (yaml) template instruction form', () => {
    const instruction = 'template: accuweather/api/call\nparameters:\n  q: x'

    expect(
      resolveAbilityIcon({ name: 'Search Location', instruction }, catalogue)
    ).toBe('@logo/accuweather.com')
  })

  it('falls back to a display-name match when the instruction is not a template', () => {
    expect(
      resolveAbilityIcon(
        { name: 'Call Accuweather API', instruction: 'GET https://x' },
        catalogue
      )
    ).toBe('@logo/accuweather.com')
  })

  it('returns null when no template matches', () => {
    expect(
      resolveAbilityIcon(
        { name: 'Totally Custom', instruction: 'GET https://x' },
        catalogue
      )
    ).toBeNull()
  })

  it('returns null for a missing ability', () => {
    expect(resolveAbilityIcon(null, catalogue)).toBeNull()
  })
})

describe('resolveAbilityTemplate', () => {
  it('matches the designer resource shape (keyed by title)', () => {
    const abilityResources = {
      'accuweather/api/call': {
        title: 'Call Accuweather API',
        icon: '@logo/accuweather.com',
      },
    }

    expect(
      resolveAbilityTemplate(
        { name: 'x', instruction: '@accuweather/api/call' },
        abilityResources
      )
    ).toBe(abilityResources['accuweather/api/call'])
  })

  it('preserves a non-string (component) icon, unlike resolveAbilityIcon', () => {
    const Icon = () => null

    const abilityResources = {
      'accuweather/api/call': { title: 'Call Accuweather API', icon: Icon },
    }

    const ability = { name: 'x', instruction: '@accuweather/api/call' }

    expect(resolveAbilityTemplate(ability, abilityResources).icon).toBe(Icon)
    // @note the string-only helper drops it so DynamicIcon never sees a component
    expect(resolveAbilityIcon(ability, abilityResources)).toBeNull()
  })
})

describe('resolveAbilityDisplayIcon', () => {
  it('prefers the catalogue template icon', () => {
    expect(
      resolveAbilityDisplayIcon(
        { name: 'Search Location', instruction: '@accuweather/api/call' },
        catalogue
      )
    ).toBe('@logo/accuweather.com')
  })

  // @note last-resort net: keeps a recognizable ability looking right when it
  // resolves to no template (hand-written, or the catalogue has not loaded)
  it('falls back to the name-keyword heuristic when no template matches', () => {
    expect(
      resolveAbilityDisplayIcon(
        { name: 'Send Slack Message', instruction: 'POST https://x' },
        {}
      )
    ).toBe('@logo/slack.com')
  })

  it('falls back to the generic icon when neither template nor name matches', () => {
    expect(
      resolveAbilityDisplayIcon(
        { name: 'Totally Custom', instruction: 'GET https://x' },
        {}
      )
    ).toBe(GENERIC_ABILITY_ICON)
  })

  // @note a monochrome brand logo (ChatBotKit's) is swapped for a theme-aware
  // variant so it stays visible against a dark background - the bug this fixes
  it('maps a monochrome brand logo to its theme-aware variant', () => {
    const cbkCatalogue = buildTemplateCatalogue([
      {
        template: 'cbk/conversation/start',
        name: 'Start Conversation',
        icon: '@logo/chatbotkit.com',
      },
    ])

    expect(
      resolveAbilityDisplayIcon(
        { name: 'Start Conversation', instruction: '@cbk/conversation/start' },
        cbkCatalogue
      )
    ).toBe('@logo/chatbotkit.com;@logo/chatbotkit.com#filter=invertGrayscale')
  })
})
