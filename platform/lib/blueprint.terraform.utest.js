import { blueprintToTerraform } from './blueprint.terraform'

/**
 * Asserts that every `chatbotkit_<type>.<id>.id` reference in the output has
 * a matching `resource "chatbotkit_<type>" "<id>"` block, so the HCL never
 * carries a dangling reference.
 * @param {string} hcl
 */
function expectDeclaredReferences(hcl) {
  const declared = new Set()

  for (const match of hcl.matchAll(/resource "(chatbotkit_\w+)" "(\w+)"/g)) {
    declared.add(`${match[1]}.${match[2]}`)
  }

  const dangling = []

  for (const match of hcl.matchAll(/(chatbotkit_\w+)\.(\w+)\.id/g)) {
    const ref = `${match[1]}.${match[2]}`

    if (!declared.has(ref)) {
      dangling.push(ref)
    }
  }

  expect(dangling).toEqual([])
}

/**
 * Converts and checks that every emitted resource reference is declared.
 * @param {any} blueprint
 * @returns {string}
 */
function convert(blueprint) {
  const result = blueprintToTerraform(blueprint)

  expectDeclaredReferences(result)

  return result
}

describe('blueprintToTerraform', () => {
  it('should return empty string for null blueprint', () => {
    expect(convert(null)).toBe('')
  })

  it('should return empty string for blueprint without resources', () => {
    expect(convert({})).toBe('')
  })

  it('should generate provider configuration', () => {
    const blueprint = {
      resources: {},
    }

    const result = convert(blueprint)

    expect(result).toContain('terraform {')
    expect(result).toContain('required_providers {')
    expect(result).toContain('chatbotkit = {')
    expect(result).toContain('source = "chatbotkit/chatbotkit"')
    expect(result).toContain('provider "chatbotkit" {')
  })

  it('should convert a simple bot resource', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Test Bot',
            description: 'A test bot',
            backstory:
              'You are a helpful assistant.\nYou help users with their questions.',
            model: 'gpt-4',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('resource "chatbotkit_bot" "bot_test123" {')
    expect(result).toContain('name        = "Test Bot"')
    expect(result).toContain('description = "A test bot"')
    expect(result).toContain('backstory   = <<-EOT')
    expect(result).toContain('You are a helpful assistant.')
    expect(result).toContain('model       = "gpt-4"')
  })

  it('should convert a dataset resource', () => {
    const blueprint = {
      resources: {
        '#dataset:::data456': {
          type: 'dataset',
          data: {
            name: 'Knowledge Base',
            description: 'Test dataset',
            visibility: 'private',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      'resource "chatbotkit_dataset" "dataset_data456" {'
    )
    expect(result).toContain('name        = "Knowledge Base"')
    expect(result).toContain('description = "Test dataset"')
    expect(result).toContain('visibility  = "private"')
  })

  it('should convert a skillset resource', () => {
    const blueprint = {
      resources: {
        '#skillset:::skill789': {
          type: 'skillset',
          data: {
            name: 'Bot Skills',
            description: 'Skills for the bot',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      'resource "chatbotkit_skillset" "skillset_skill789" {'
    )
    expect(result).toContain('name        = "Bot Skills"')
    expect(result).toContain('description = "Skills for the bot"')
  })

  it('should convert an ability resource with skillset reference', () => {
    const blueprint = {
      resources: {
        '#skillset:::skill789': {
          type: 'skillset',
          data: {
            name: 'Bot Skills',
          },
        },
        '#ability:::ability123': {
          type: 'ability',
          data: {
            skillsetId: '#skillset:::skill789',
            name: 'Web Search',
            description: 'Search the web',
            instruction: '```search\nquery: $[query! ys]\n```',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      'resource "chatbotkit_skillset_ability" "ability_ability123" {'
    )
    expect(result).toContain(
      'skillset_id = chatbotkit_skillset.skillset_skill789.id'
    )
    expect(result).toContain('name        = "Web Search"')
    expect(result).toContain('description = "Search the web"')
    expect(result).toContain('instruction = <<-EOT')
  })

  it('should convert an ability resource with all four links', () => {
    const blueprint = {
      resources: {
        '#skillset:::skill789': {
          type: 'skillset',
          data: { name: 'Bot Skills' },
        },
        '#bot:::bot456': {
          type: 'bot',
          data: { name: 'Target Bot' },
        },
        '#file:::file321': {
          type: 'file',
          data: { name: 'Script' },
        },
        '#ability:::ability123': {
          type: 'ability',
          data: {
            skillsetId: '#skillset:::skill789',
            name: 'Call Bot',
            linkedSecretId: 'secret_literal',
            linkedFileId: '#file:::file321',
            linkedBotId: '#bot:::bot456',
            linkedSpaceId: 'space_literal',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('secret_id   = "secret_literal"')
    expect(result).toContain('file_id     = chatbotkit_file.file_file321.id')
    expect(result).toContain('bot_id      = chatbotkit_bot.bot_bot456.id')
    expect(result).toContain('space_id    = "space_literal"')
  })

  it('should omit link attributes when the ability has no links', () => {
    const blueprint = {
      resources: {
        '#ability:::ability123': {
          type: 'ability',
          data: {
            name: 'Plain',
            linkedSecretId: null,
            linkedFileId: '',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('name        = "Plain"')
    expect(result).not.toContain('secret_id')
    expect(result).not.toContain('file_id')
    expect(result).not.toContain('bot_id')
    expect(result).not.toContain('space_id')
  })

  it('should convert a secret resource with a sensitive value variable', () => {
    const blueprint = {
      resources: {
        '#secret:::sec001': {
          type: 'secret',
          data: {
            name: 'API Key',
            description: 'External API key',
            type: 'bearer',
            kind: 'personal',
            visibility: 'private',
            value: 'super-secret-value',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('resource "chatbotkit_secret" "secret_sec001" {')
    expect(result).toContain('name        = "API Key"')
    expect(result).toContain('description = "External API key"')
    expect(result).toContain('type        = "bearer"')
    expect(result).toContain('kind        = "personal"')
    expect(result).toContain('visibility  = "private"')
    expect(result).toContain('value       = var.secret_sec001_value')
    expect(result).toContain('variable "secret_sec001_value" {')
    expect(result).toContain('sensitive   = true')
    // the value itself must never land in the HCL
    expect(result).not.toContain('super-secret-value')
  })

  it('should convert a space resource', () => {
    const blueprint = {
      resources: {
        '#space:::sp001': {
          type: 'space',
          data: {
            name: 'Team Space',
            description: 'Shared space',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('resource "chatbotkit_space" "space_sp001" {')
    expect(result).toContain('name        = "Team Space"')
    expect(result).toContain('description = "Shared space"')
    expect(result).not.toContain('variable "')
  })

  it('should resolve all four ability links to blueprint-local resources', () => {
    const blueprint = {
      resources: {
        '#skillset:::skill789': {
          type: 'skillset',
          data: { name: 'Bot Skills' },
        },
        '#secret:::sec001': {
          type: 'secret',
          data: { name: 'API Key', type: 'bearer' },
        },
        '#file:::file321': {
          type: 'file',
          data: { name: 'Script' },
        },
        '#bot:::bot456': {
          type: 'bot',
          data: { name: 'Target Bot' },
        },
        '#space:::sp001': {
          type: 'space',
          data: { name: 'Team Space' },
        },
        '#ability:::ability123': {
          type: 'ability',
          data: {
            skillsetId: '#skillset:::skill789',
            name: 'Call Bot',
            linkedSecretId: '#secret:::sec001',
            linkedFileId: '#file:::file321',
            linkedBotId: '#bot:::bot456',
            linkedSpaceId: '#space:::sp001',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('secret_id   = chatbotkit_secret.secret_sec001.id')
    expect(result).toContain('file_id     = chatbotkit_file.file_file321.id')
    expect(result).toContain('bot_id      = chatbotkit_bot.bot_bot456.id')
    expect(result).toContain('space_id    = chatbotkit_space.space_sp001.id')

    expect(result).toContain('resource "chatbotkit_secret" "secret_sec001" {')
    expect(result).toContain('resource "chatbotkit_file" "file_file321" {')
    expect(result).toContain('resource "chatbotkit_bot" "bot_bot456" {')
    expect(result).toContain('resource "chatbotkit_space" "space_sp001" {')

    // linked resources are declared before the ability that points at them
    const abilityIndex = result.indexOf(
      'resource "chatbotkit_skillset_ability"'
    )

    expect(result.indexOf('resource "chatbotkit_secret"')).toBeLessThan(
      abilityIndex
    )
    expect(result.indexOf('resource "chatbotkit_space"')).toBeLessThan(
      abilityIndex
    )
    expect(result.indexOf('resource "chatbotkit_file"')).toBeLessThan(
      abilityIndex
    )
  })

  it('should fall back to a variable placeholder for a blueprint-local link without a provider resource', () => {
    const blueprint = {
      resources: {
        '#widget:::w1': {
          type: 'widget',
          data: { name: 'Unsupported' },
        },
        '#ability:::ability123': {
          type: 'ability',
          data: {
            name: 'Odd Link',
            linkedBotId: '#widget:::w1',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('bot_id      = var.widget_w1_id')
    expect(result).toContain('variable "widget_w1_id" {')
    expect(result).toContain(
      '# The provider has no resource for blueprint type "widget"'
    )
    expect(result).not.toContain('chatbotkit_widget')
  })

  it('should declare a shared placeholder variable only once', () => {
    const blueprint = {
      resources: {
        '#widget:::w1': {
          type: 'widget',
          data: { name: 'Unsupported' },
        },
        '#ability:::a1': {
          type: 'ability',
          data: { name: 'One', linkedBotId: '#widget:::w1' },
        },
        '#ability:::a2': {
          type: 'ability',
          data: { name: 'Two', linkedBotId: '#widget:::w1' },
        },
      },
    }

    const result = convert(blueprint)

    expect(result.match(/variable "widget_w1_id" \{/g)).toHaveLength(1)
  })

  it('should detect dangling references with the assertion helper', () => {
    expect(() =>
      expectDeclaredReferences('bot_id = chatbotkit_bot.bot_missing.id')
    ).toThrow()

    expect(() =>
      expectDeclaredReferences(
        'resource "chatbotkit_bot" "bot_ok" {}\nbot_id = chatbotkit_bot.bot_ok.id'
      )
    ).not.toThrow()
  })

  it('should convert bot with dataset and skillset references', () => {
    const blueprint = {
      resources: {
        '#dataset:::data456': {
          type: 'dataset',
          data: {
            name: 'Knowledge Base',
          },
        },
        '#skillset:::skill789': {
          type: 'skillset',
          data: {
            name: 'Bot Skills',
          },
        },
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Test Bot',
            datasetId: '#dataset:::data456',
            skillsetId: '#skillset:::skill789',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      'dataset_id  = chatbotkit_dataset.dataset_data456.id'
    )
    expect(result).toContain(
      'skillset_id = chatbotkit_skillset.skillset_skill789.id'
    )
  })

  it('should properly order resources (dataset, skillset, ability, bot)', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: { name: 'Test Bot' },
        },
        '#ability:::ability123': {
          type: 'ability',
          data: { name: 'Web Search' },
        },
        '#skillset:::skill789': {
          type: 'skillset',
          data: { name: 'Bot Skills' },
        },
        '#dataset:::data456': {
          type: 'dataset',
          data: { name: 'Knowledge Base' },
        },
      },
    }

    const result = convert(blueprint)

    // Dataset should come before bot
    const datasetIndex = result.indexOf('resource "chatbotkit_dataset"')
    const skillsetIndex = result.indexOf('resource "chatbotkit_skillset"')
    const abilityIndex = result.indexOf(
      'resource "chatbotkit_skillset_ability"'
    )
    const botIndex = result.indexOf('resource "chatbotkit_bot"')

    expect(datasetIndex).toBeLessThan(botIndex)
    expect(skillsetIndex).toBeLessThan(abilityIndex)
    expect(abilityIndex).toBeLessThan(botIndex)
  })

  it('should escape special characters in strings', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Bot with "quotes"',
            description: 'Has \\ backslash and $ dollar',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('name        = "Bot with \\"quotes\\""')
    expect(result).toContain('description = "Has \\\\ backslash and $ dollar"')
  })

  it('should escape `${` so it is not read as an interpolation', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Costs ${price} per seat',
            description: 'Template ${var.x}',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('name        = "Costs $${price} per seat"')
    expect(result).toContain('description = "Template $${var.x}"')
    expect(result).not.toMatch(/[^$]\$\{/)
  })

  it('should escape `%{` so it is not read as a directive', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Uses %{ if x } syntax',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('name        = "Uses %%{ if x } syntax"')
    expect(result).not.toMatch(/[^%]%\{/)
  })

  it('should emit a heredoc for a quoted attribute containing a newline', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            name: 'Line one',
            description: 'First line\nSecond line with "quotes" and \\ backslash',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('name        = "Line one"')
    expect(result).toContain(
      '  description = <<-EOT\n  First line\n  Second line with "quotes" and \\ backslash\n  EOT'
    )
    // @note the multiline value must not be emitted as a quoted string
    expect(result).not.toContain('description = "')
  })

  it('should escape template sequences inside a heredoc', () => {
    const blueprint = {
      resources: {
        '#skillset:::sk1': { type: 'skillset', data: { name: 'S' } },
        '#ability:::ab1': {
          type: 'ability',
          data: {
            skillsetId: '#skillset:::sk1',
            name: 'A',
            instruction: 'Use ${input}\nand %{ if x } here',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      '  instruction = <<-EOT\n  Use $${input}\n  and %%{ if x } here\n  EOT'
    )
  })

  it('should pick a heredoc delimiter that does not occur in the body', () => {
    const blueprint = {
      resources: {
        '#bot:::test123': {
          type: 'bot',
          data: {
            backstory: 'Line one\nEOT\nline three',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      '  backstory   = <<-EOT1\n  Line one\n  EOT\n  line three\n  EOT1'
    )
  })

  it('should convert a file resource', () => {
    const blueprint = {
      resources: {
        '#file:::file001': {
          type: 'file',
          data: {
            name: 'Training Data',
            description: 'A file with training data',
            type: 'text/plain',
            visibility: 'private',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('resource "chatbotkit_file" "file_file001" {')
    expect(result).toContain('name        = "Training Data"')
    expect(result).toContain('description = "A file with training data"')
    expect(result).toContain('type        = "text/plain"')
    expect(result).toContain('visibility  = "private"')
  })

  it('should convert a trigger integration resource', () => {
    const blueprint = {
      resources: {
        '#bot:::mybot': {
          type: 'bot',
          data: { name: 'My Bot' },
        },
        '#triggerIntegration:::trig001': {
          type: 'triggerIntegration',
          data: {
            botId: '#bot:::mybot',
            name: 'Daily Task',
            description: 'Runs daily',
            schedule: 'daily',
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain(
      'resource "chatbotkit_trigger_integration" "triggerIntegration_trig001" {'
    )
    expect(result).toContain('bot_id      = chatbotkit_bot.bot_mybot.id')
    expect(result).toContain('name        = "Daily Task"')
    expect(result).toContain('description = "Runs daily"')
    expect(result).toContain('schedule    = "daily"')
  })

  it('should output trigger integration before bot in resource order', () => {
    const blueprint = {
      resources: {
        '#bot:::b1': { type: 'bot', data: { name: 'Bot' } },
        '#triggerIntegration:::t1': {
          type: 'triggerIntegration',
          data: { name: 'Trigger', botId: '#bot:::b1' },
        },
      },
    }

    const result = convert(blueprint)

    // trigger integration comes after bot in resourceOrder array
    const botIndex = result.indexOf('resource "chatbotkit_bot"')
    const triggerIndex = result.indexOf(
      'resource "chatbotkit_trigger_integration"'
    )

    expect(botIndex).toBeLessThan(triggerIndex)
  })

  it('should convert bot with privacy and moderation boolean fields', () => {
    const blueprint = {
      resources: {
        '#bot:::safebot': {
          type: 'bot',
          data: {
            name: 'Safe Bot',
            privacy: true,
            moderation: false,
          },
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('privacy     = true')
    expect(result).toContain('moderation  = false')
  })

  it('should use string literal when reference is not in the resource map', () => {
    const blueprint = {
      resources: {
        '#bot:::b1': {
          type: 'bot',
          data: {
            name: 'Bot',
            // @note dangling reference - dataset not in this blueprint
            datasetId: '#dataset:::orphan',
          },
        },
      },
    }

    const result = convert(blueprint)

    // should fall back to the raw reference as a quoted string literal
    expect(result).toContain('dataset_id  = "#dataset:::orphan"')
    expect(result).not.toContain('chatbotkit_dataset.dataset_orphan.id')
  })

  it('should skip resources with unknown types', () => {
    const blueprint = {
      resources: {
        '#unknown:::xyz': {
          type: 'unknownType',
          data: { name: 'Unsupported' },
        },
      },
    }

    const result = convert(blueprint)

    // only provider block should be present; no resource block for the unknown type
    expect(result).toContain('provider "chatbotkit" {')
    expect(result).not.toContain('resource "chatbotkit_unknownType"')
  })

  it('should handle resources with missing or empty data', () => {
    const blueprint = {
      resources: {
        '#bot:::empty': {
          type: 'bot',
          data: {},
        },
      },
    }

    const result = convert(blueprint)

    expect(result).toContain('resource "chatbotkit_bot" "bot_empty" {')
    expect(result).toContain('}')
    // no fields should be emitted when data is empty
    expect(result).not.toContain('name')
    expect(result).not.toContain('model')
  })
})
