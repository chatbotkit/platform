/* eslint-disable @typescript-eslint/no-require-imports */
import {
  GENERIC_ABILITY_ICON,
  buildTemplateCatalogue,
  resolveAbilityDisplayIcon,
  resolveAbilityIcon,
  resolveAbilityTemplate,
} from './ability.icon'

jest.mock('@/lib/icon.theme', () => ({
  toThemeAwareIcon: jest.fn((icon) => `themed-${icon}`),
}))

jest.mock('@/lib/instruction.template.parse', () => ({
  parseTemplateInstruction: jest.fn((instruction) => {
    if (instruction.includes('template:')) {
      return { template: instruction.split('template:')[1] }
    }

    throw new Error('Invalid template instruction')
  }),
}))

jest.mock('@/lib/name.icon', () => ({
  nameToIcon: jest.fn((name) => {
    if (name === 'slack') {
      return '@slack-icon'
    }

    if (name === 'github') {
      return '@github-icon'
    }

    return null
  }),
}))

jest.mock('@/lib/template', () => ({
  getTemplate: jest.fn((templateId, catalogue) => {
    // Return exact match or try to find by first part of the template ID
    if (catalogue[templateId]) {
      return catalogue[templateId]
    }

    const firstPart = templateId.split('/')[0]

    return catalogue[firstPart] || null
  }),
  getTemplateRealName: jest.fn((templateId) => {
    // Return first part of template ID (e.g., 'slack/send' -> 'slack')
    const firstPart = templateId.split('/')[0]

    return firstPart || templateId
  }),
}))

describe('ability.icon', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GENERIC_ABILITY_ICON', () => {
    it('should be defined', () => {
      expect(GENERIC_ABILITY_ICON).toBeDefined()
      expect(GENERIC_ABILITY_ICON).toBe('@heroicons/sparkles')
    })
  })

  describe('buildTemplateCatalogue', () => {
    it('should return empty object for empty array', () => {
      const result = buildTemplateCatalogue([])

      expect(result).toEqual({})
    })

    it('should return empty object for undefined input', () => {
      const result = buildTemplateCatalogue()

      expect(result).toEqual({})
    })

    it('should build catalogue from templates array', () => {
      const templates = [
        { template: 'slack/send', name: 'Slack Send' },
        { template: 'github/issue', name: 'GitHub Issue' },
      ]

      const result = buildTemplateCatalogue(templates)

      expect(result).toHaveProperty('slack')
      expect(result).toHaveProperty('github')
    })

    it('should filter out items without template field', () => {
      const templates = [
        { template: 'slack/send', name: 'Slack Send' },
        { name: 'No Template' },
        { template: null, name: 'Null Template' },
      ]

      const result = buildTemplateCatalogue(templates)

      expect(Object.keys(result).length).toBe(1)
      expect(result).toHaveProperty('slack')
    })

    it('should use getTemplateRealName to generate keys', () => {
      const templates = [{ template: 'slack/send/message', name: 'Slack Send' }]

      const result = buildTemplateCatalogue(templates)

      expect(result).toHaveProperty('slack')
    })

    it('should preserve all properties of templates', () => {
      const templates = [
        {
          template: 'slack/send',
          name: 'Slack Send',
          icon: '@slack-icon',
          description: 'Send Slack message',
        },
      ]

      const result = buildTemplateCatalogue(templates)

      expect(result.slack).toEqual(templates[0])
    })

    it('should handle empty template field', () => {
      const templates = [
        { template: '', name: 'Empty Template' },
        { template: 'valid/template', name: 'Valid Template' },
      ]

      const result = buildTemplateCatalogue(templates)

      expect(Object.keys(result).length).toBe(1)
      expect(result).toHaveProperty('valid')
    })
  })

  describe('resolveAbilityTemplate', () => {
    const mockCatalogue = {
      slack: { template: 'slack/send', icon: '@slack-icon', name: 'Slack' },
      github: {
        template: 'github/issue',
        icon: '@github-icon',
        name: 'GitHub',
      },
    }

    it('should return null for null ability', () => {
      const result = resolveAbilityTemplate(null, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return null for undefined ability', () => {
      const result = resolveAbilityTemplate(undefined, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return null for empty catalogue', () => {
      const ability = { name: 'Slack', instruction: 'some instruction' }
      const result = resolveAbilityTemplate(ability, {})

      expect(result).toBeNull()
    })

    it('should resolve template from instruction when available', () => {
      const ability = {
        name: 'My Slack Action',
        instruction: 'template:slack/send',
      }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })

    it('should fall back to name matching when template instruction parsing fails', () => {
      const ability = {
        name: 'Slack',
        instruction: 'invalid instruction',
      }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })

    it('should fall back to name matching when getTemplate returns null', () => {
      const ability = {
        name: 'GitHub',
        instruction: 'template:unknown',
      }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.github)
    })

    it('should match by title if available', () => {
      const catalogueWithTitle = {
        slack: { title: 'Slack Sender', icon: '@slack-icon' },
      }

      const ability = { name: 'Slack Sender', instruction: '' }

      const result = resolveAbilityTemplate(ability, catalogueWithTitle)

      expect(result).toBe(catalogueWithTitle.slack)
    })

    it('should prefer exact template match over name match', () => {
      const ability = {
        name: 'GitHub',
        instruction: 'template:slack',
      }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })

    it('should return null for ability with no name and no template match', () => {
      const ability = { instruction: 'some random instruction' }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should handle empty instruction gracefully', () => {
      const ability = { name: 'Slack', instruction: '' }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })

    it('should handle null name', () => {
      const ability = { name: null, instruction: 'template:slack' }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })

    it('should handle null instruction', () => {
      const ability = { name: 'Slack', instruction: null }

      const result = resolveAbilityTemplate(ability, mockCatalogue)

      expect(result).toBe(mockCatalogue.slack)
    })
  })

  describe('resolveAbilityIcon', () => {
    const mockCatalogue = {
      slack: { template: 'slack/send', icon: '@slack-icon' },
      github: { template: 'github/issue', icon: '@github-icon' },
      noicon: { template: 'noicon', icon: null },
    }

    it('should return null for ability with no matching template', () => {
      const ability = { name: 'Unknown' }

      const result = resolveAbilityIcon(ability, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return icon from template', () => {
      const ability = { name: 'Slack', instruction: 'template:slack' }

      const result = resolveAbilityIcon(ability, mockCatalogue)

      expect(result).toBe('@slack-icon')
    })

    it('should return null if icon is not a string', () => {
      const ability = { name: 'noicon', instruction: 'template:noicon' }

      const result = resolveAbilityIcon(ability, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return null if icon is empty string', () => {
      const catalogueWithEmpty = {
        empty: { icon: '' },
      }

      const ability = { name: 'empty' }

      const result = resolveAbilityIcon(ability, catalogueWithEmpty)

      expect(result).toBeNull()
    })

    it('should return null for null ability', () => {
      const result = resolveAbilityIcon(null, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return null for undefined ability', () => {
      const result = resolveAbilityIcon(undefined, mockCatalogue)

      expect(result).toBeNull()
    })

    it('should return null with empty catalogue', () => {
      const ability = { name: 'Slack' }

      const result = resolveAbilityIcon(ability, {})

      expect(result).toBeNull()
    })
  })

  describe('resolveAbilityDisplayIcon', () => {
    const mockCatalogue = {
      slack: { icon: '@slack-icon' },
      github: { icon: '@github-icon' },
    }

    it('should return themed generic icon when no match found', () => {
      const ability = { name: 'Unknown' }

      const result = resolveAbilityDisplayIcon(ability, mockCatalogue)

      expect(result).toBe(`themed-${GENERIC_ABILITY_ICON}`)
    })

    it('should return themed icon from catalogue', () => {
      const ability = { name: 'Slack', instruction: 'template:slack' }

      const result = resolveAbilityDisplayIcon(ability, mockCatalogue)

      expect(result).toBe('themed-@slack-icon')
    })

    it('should use name heuristic when catalogue icon not found', () => {
      const ability = { name: 'slack' }

      const result = resolveAbilityDisplayIcon(ability, {})

      expect(result).toBe('themed-@slack-icon')
    })

    it('should use generic icon when name heuristic also fails', () => {
      const ability = { name: 'unknown' }

      const result = resolveAbilityDisplayIcon(ability, {})

      expect(result).toBe(`themed-${GENERIC_ABILITY_ICON}`)
    })

    it('should prioritize catalogue icon over name heuristic', () => {
      const ability = { name: 'slack', instruction: 'template:slack' }

      const result = resolveAbilityDisplayIcon(ability, mockCatalogue)

      expect(result).toBe('themed-@slack-icon')
    })

    it('should handle null ability', () => {
      const result = resolveAbilityDisplayIcon(null, mockCatalogue)

      expect(result).toBe(`themed-${GENERIC_ABILITY_ICON}`)
    })

    it('should handle undefined ability', () => {
      const result = resolveAbilityDisplayIcon(undefined, mockCatalogue)

      expect(result).toBe(`themed-${GENERIC_ABILITY_ICON}`)
    })

    it('should handle empty name', () => {
      const ability = { name: '' }

      const result = resolveAbilityDisplayIcon(ability, {})

      expect(result).toBe(`themed-${GENERIC_ABILITY_ICON}`)
    })

    it('should apply theme awareness to all icon paths', () => {
      const { toThemeAwareIcon } = require('@/lib/icon.theme')

      const ability = { name: 'slack', instruction: 'template:slack' }

      resolveAbilityDisplayIcon(ability, mockCatalogue)

      expect(toThemeAwareIcon).toHaveBeenCalled()
    })

    it('should handle complex ability with all fields', () => {
      const ability = {
        name: 'My Slack Integration',
        instruction: 'template:slack/send',
      }

      const result = resolveAbilityDisplayIcon(ability, mockCatalogue)

      expect(result).toBe('themed-@slack-icon')
    })
  })
})
