import {
  buildSlackManifest,
  buildSlackManifestInstallUrl,
} from '@/lib/slack.manifest'

describe('buildSlackManifest', () => {
  const baseUrl = 'https://api.example.com'

  const basicIntegration = {
    id: 'slack-123',
    name: 'Test Bot',
    description: 'A test chatbot for Slack integration',
  }

  describe('basic functionality', () => {
    it('should build a valid manifest with required fields', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest).toHaveProperty('display_information')
      expect(manifest).toHaveProperty('settings')
      expect(manifest).toHaveProperty('features')
      expect(manifest).toHaveProperty('oauth_config')
    })

    it('should use integration name in display information', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.display_information.name).toBe('Test Bot')
    })

    it('should include integration ID in all URL endpoints', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.settings.event_subscriptions.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/event'
      )
      expect(manifest.settings.interactivity.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/interaction'
      )
      expect(manifest.features.slash_commands[0].url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/command'
      )
    })

    it('should create slash command from bot name slug', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.features.slash_commands[0].command).toBe('/test-bot')
      expect(manifest.features.slash_commands[0].description).toBe(
        'Interact with Test Bot in any channel or direct message.'
      )
    })
  })

  describe('name handling', () => {
    it('should default to ChatBotKit when name is missing', () => {
      const integrationWithoutName = {
        id: 'slack-123',
        description: 'A test bot',
      }

      const manifest = buildSlackManifest(integrationWithoutName, baseUrl)

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.features.bot_user.display_name).toBe('ChatBotKit')
      expect(manifest.features.slash_commands[0].command).toBe('/chatbotkit')
    })

    it('should default to ChatBotKit when name is empty string', () => {
      const integrationWithEmptyName = {
        id: 'slack-123',
        name: '',
        description: 'A test bot',
      }

      const manifest = buildSlackManifest(integrationWithEmptyName, baseUrl)

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.features.bot_user.display_name).toBe('ChatBotKit')
    })

    it('should handle special characters in bot name for slash command', () => {
      const integrationWithSpecialChars = {
        id: 'slack-123',
        name: 'My Super Bot!!! @#$',
      }

      const manifest = buildSlackManifest(integrationWithSpecialChars, baseUrl)

      expect(manifest.features.slash_commands[0].command).toBe('/my-super-bot')
    })

    it('should handle spaces and mixed case in bot name', () => {
      const integrationWithSpaces = {
        id: 'slack-123',
        name: 'Customer Support Bot',
      }

      const manifest = buildSlackManifest(integrationWithSpaces, baseUrl)

      expect(manifest.features.slash_commands[0].command).toBe(
        '/customer-support-bot'
      )
    })
  })

  // @note Slack rejects slashes and square brackets in the app name, and the
  // bot display name only allows `a-z 0-9 - _ .`. Make sure none of those
  // characters leak into any name-derived field of the manifest.
  // @see https://docs.slack.dev/reference/app-manifest
  describe('disallowed character sanitization', () => {
    it('should strip forward slashes from the app display name', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: 'Support/Sales Bot' },
        baseUrl
      )

      expect(manifest.display_information.name).toBe('Support Sales Bot')
      expect(manifest.display_information.name).not.toContain('/')
    })

    it('should strip forward slashes from the bot display name', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: 'Support/Sales Bot' },
        baseUrl
      )

      expect(manifest.features.bot_user.display_name).toBe('Support Sales Bot')
      expect(manifest.features.bot_user.display_name).not.toContain('/')
    })

    it('should strip backslashes from name-derived fields', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: 'Foo\\Bar Bot' },
        baseUrl
      )

      expect(manifest.display_information.name).toBe('Foo Bar Bot')
      expect(manifest.features.bot_user.display_name).toBe('Foo Bar Bot')
      expect(manifest.display_information.name).not.toContain('\\')
    })

    it('should strip individual square brackets, not just the empty pair', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: '[Beta] Support Bot' },
        baseUrl
      )

      expect(manifest.display_information.name).toBe('Beta Support Bot')
      expect(manifest.display_information.name).not.toMatch(/[[\]]/)
      expect(manifest.features.bot_user.display_name).not.toMatch(/[[\]]/)
    })

    it('should keep the slash command free of stray slashes', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: 'AI/ML/Ops Bot' },
        baseUrl
      )

      const command = manifest.features.slash_commands[0].command

      expect(command).toBe('/ai-ml-ops-bot')
      // exactly one leading slash, nothing slash-like after it
      expect(command).toMatch(/^\/[a-z0-9_-]+$/)
    })

    it('should fall back to the default when sanitizing leaves nothing usable', () => {
      const manifest = buildSlackManifest(
        { id: 'slack-123', name: '///[]\\' },
        baseUrl
      )

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.features.bot_user.display_name).toBe('ChatBotKit')
      expect(manifest.features.slash_commands[0].command).toBe('/chatbotkit')
    })

    it('should not leave disallowed characters anywhere in the install URL manifest', () => {
      const installUrl = buildSlackManifestInstallUrl(
        { id: 'slack-123', name: 'Support/Sales [Beta] Bot' },
        baseUrl
      )
      const manifest = JSON.parse(
        new URL(installUrl).searchParams.get('manifest_json')
      )

      expect(manifest.display_information.name).toBe('Support Sales Beta Bot')
      expect(manifest.features.bot_user.display_name).not.toMatch(/[\\/[\]]/)
      expect(manifest.features.slash_commands[0].command).toMatch(
        /^\/[a-z0-9_-]+$/
      )
    })
  })

  describe('description handling', () => {
    it('should use short description when within 174 character limit', () => {
      const shortDescription = 'A helpful bot for customer support'

      const integrationWithShortDesc = {
        id: 'slack-123',
        name: 'Support Bot',
        description: shortDescription,
      }

      const manifest = buildSlackManifest(integrationWithShortDesc, baseUrl)

      expect(manifest.display_information.description).toBe(shortDescription)
      expect(manifest.display_information.long_description).toBeUndefined()
    })

    it('should use long description when exceeding 174 character limit', () => {
      const longDescription = 'A'.repeat(175) // 175 characters

      const integrationWithLongDesc = {
        id: 'slack-123',
        name: 'Support Bot',
        description: longDescription,
      }

      const manifest = buildSlackManifest(integrationWithLongDesc, baseUrl)

      expect(manifest.display_information.description).toBeUndefined()
      expect(manifest.display_information.long_description).toBe(
        longDescription
      )
    })

    it('should handle exactly 174 character description as short', () => {
      const exactLimitDescription = 'A'.repeat(174) // Exactly 174 characters

      const integrationWithExactDesc = {
        id: 'slack-123',
        name: 'Support Bot',
        description: exactLimitDescription,
      }

      const manifest = buildSlackManifest(integrationWithExactDesc, baseUrl)

      expect(manifest.display_information.description).toBe(
        exactLimitDescription
      )
      expect(manifest.display_information.long_description).toBeUndefined()
    })

    it('should omit description fields when description is missing', () => {
      const integrationWithoutDescription = {
        id: 'slack-123',
        name: 'Test Bot',
      }

      const manifest = buildSlackManifest(
        integrationWithoutDescription,
        baseUrl
      )

      expect(manifest.display_information.description).toBeUndefined()
      expect(manifest.display_information.long_description).toBeUndefined()
    })

    it('should omit description fields when description is empty string', () => {
      const integrationWithEmptyDescription = {
        id: 'slack-123',
        name: 'Test Bot',
        description: '',
      }

      const manifest = buildSlackManifest(
        integrationWithEmptyDescription,
        baseUrl
      )

      expect(manifest.display_information.description).toBeUndefined()
      expect(manifest.display_information.long_description).toBeUndefined()
    })
  })

  describe('URL construction', () => {
    it('should handle different base URLs correctly', () => {
      const testCases = [
        'https://api.chatbotkit.com',
        'http://localhost:3000',
        'https://staging.chatbotkit.com',
      ]

      testCases.forEach((testBaseUrl) => {
        const manifest = buildSlackManifest(basicIntegration, testBaseUrl)

        expect(manifest.settings.event_subscriptions.request_url).toBe(
          `${testBaseUrl}/api/v1/integration/slack/slack-123/event`
        )
        expect(manifest.settings.interactivity.request_url).toBe(
          `${testBaseUrl}/api/v1/integration/slack/slack-123/interaction`
        )
        expect(manifest.features.slash_commands[0].url).toBe(
          `${testBaseUrl}/api/v1/integration/slack/slack-123/command`
        )
      })
    })

    it('should handle base URL with trailing slash', () => {
      const baseUrlWithSlash = 'https://api.example.com/'

      const manifest = buildSlackManifest(basicIntegration, baseUrlWithSlash)

      expect(manifest.settings.event_subscriptions.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/event'
      )
    })

    it('should handle integration IDs with special characters', () => {
      const integrationWithSpecialId = {
        id: 'slack-test_123-456',
        name: 'Test Bot',
      }

      const manifest = buildSlackManifest(integrationWithSpecialId, baseUrl)

      expect(manifest.settings.event_subscriptions.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-test_123-456/event'
      )
    })
  })

  describe('static configuration values', () => {
    it('should include all required bot events', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      const expectedEvents = [
        'app_mention',
        'message.channels',
        'message.groups',
        'message.im',
        'message.mpim',
      ]

      expect(manifest.settings.event_subscriptions.bot_events).toEqual(
        expectedEvents
      )
    })

    it('should include all required OAuth scopes', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      const expectedScopes = [
        'app_mentions:read',
        'groups:history',
        'chat:write',
        'channels:history',
        'im:history',
        'im:read',
        'mpim:history',
        'users:read',
        'channels:read',
        'groups:read',
        'commands',
        'files:read',
      ]

      expect(manifest.oauth_config.scopes.bot).toEqual(expectedScopes)
    })

    it('should configure app home settings correctly', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.features.app_home).toEqual({
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      })
    })

    it('should configure bot user settings correctly', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.features.bot_user.always_online).toBe(true)
    })

    it('should enable interactivity', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.settings.interactivity.is_enabled).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle integration with only required id field', () => {
      const minimalIntegration = { id: 'slack-minimal' }

      const manifest = buildSlackManifest(minimalIntegration, baseUrl)

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.features.slash_commands[0].command).toBe('/chatbotkit')
      expect(manifest.settings.event_subscriptions.request_url).toContain(
        'slack-minimal'
      )
    })

    it('should handle null and undefined description gracefully', () => {
      const integrationWithNullDesc = {
        id: 'slack-123',
        name: 'Test Bot',
        description: null,
      }

      const manifest = buildSlackManifest(integrationWithNullDesc, baseUrl)

      expect(manifest.display_information.description).toBeUndefined()
      expect(manifest.display_information.long_description).toBeUndefined()
    })

    it('should handle very long integration names', () => {
      const longName =
        'Very Long Bot Name That Exceeds Normal Limits For Testing Purposes'

      const integrationWithLongName = {
        id: 'slack-123',
        name: longName,
      }

      const manifest = buildSlackManifest(integrationWithLongName, baseUrl)

      expect(manifest.display_information.name).toBe(longName)
      expect(manifest.features.slash_commands[0].command).toBe(
        '/very-long-bot-name-that-exceeds-normal-limits-for-testing-purposes'
      )
    })

    it('should handle numeric values in integration object', () => {
      const integrationWithNumbers = {
        id: 'slack-123',
        name: 'Bot 2024',
        description: 'Version 2.0 of our bot',
      }

      const manifest = buildSlackManifest(integrationWithNumbers, baseUrl)

      expect(manifest.display_information.name).toBe('Bot 2024')
      expect(manifest.features.slash_commands[0].command).toBe('/bot-2024')
    })
  })

  describe('OAuth configuration validation', () => {
    it('should include user scopes in OAuth configuration', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.oauth_config.scopes.user).toEqual(['search:read'])
    })

    it('should include both bot and user scopes', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.oauth_config.scopes).toHaveProperty('bot')
      expect(manifest.oauth_config.scopes).toHaveProperty('user')
      expect(Array.isArray(manifest.oauth_config.scopes.bot)).toBe(true)
      expect(Array.isArray(manifest.oauth_config.scopes.user)).toBe(true)
    })

    it('should have specific bot scopes for proper functionality', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      const requiredBotScopes = [
        'app_mentions:read',
        'groups:history',
        'chat:write',
        'channels:history',
        'im:history',
        'mpim:history',
        'users:read',
        'channels:read',
        'groups:read',
        'commands',
      ]

      requiredBotScopes.forEach((scope) => {
        expect(manifest.oauth_config.scopes.bot).toContain(scope)
      })
    })
  })

  describe('manifest structure validation', () => {
    it('should return an object with all required top-level keys', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      const requiredKeys = [
        'display_information',
        'settings',
        'features',
        'oauth_config',
      ]

      requiredKeys.forEach((key) => {
        expect(manifest).toHaveProperty(key)
        expect(manifest[key]).toBeDefined()
      })
    })

    it('should include exactly one slash command', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.features.slash_commands).toHaveLength(1)
      expect(manifest.features.slash_commands[0]).toHaveProperty('command')
      expect(manifest.features.slash_commands[0]).toHaveProperty('url')
      expect(manifest.features.slash_commands[0]).toHaveProperty('description')
      expect(manifest.features.slash_commands[0]).toHaveProperty('usage_hint')
    })

    it('should include proper usage hint for slash command', () => {
      const manifest = buildSlackManifest(basicIntegration, baseUrl)

      expect(manifest.features.slash_commands[0].usage_hint).toBe(
        'ask a question or give a command'
      )
    })
  })
})

describe('buildSlackManifestInstallUrl', () => {
  const baseUrl = 'https://api.example.com'

  const basicIntegration = {
    id: 'slack-123',
    name: 'Test Bot',
    description: 'A test chatbot for Slack integration',
  }

  describe('basic functionality', () => {
    it('should build a valid Slack app installation URL', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)

      expect(installUrl).toMatch(/^https:\/\/api\.slack\.com\/apps\?/)
      expect(installUrl).toContain('new_app=1')
      expect(installUrl).toContain('manifest_json=')
    })

    it('should include encoded manifest in URL parameters', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const url = new URL(installUrl)

      expect(url.searchParams.get('new_app')).toBe('1')
      expect(url.searchParams.get('manifest_json')).toBeTruthy()

      // Verify the manifest can be decoded and is valid JSON
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest).toHaveProperty('display_information')
      expect(manifest).toHaveProperty('settings')
      expect(manifest).toHaveProperty('features')
      expect(manifest).toHaveProperty('oauth_config')
    })

    it('should generate consistent URLs for same input', () => {
      const installUrl1 = buildSlackManifestInstallUrl(
        basicIntegration,
        baseUrl
      )
      const installUrl2 = buildSlackManifestInstallUrl(
        basicIntegration,
        baseUrl
      )

      expect(installUrl1).toBe(installUrl2)
    })
  })

  describe('manifest content validation', () => {
    it('should include correct integration data in embedded manifest', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.name).toBe('Test Bot')
      expect(manifest.display_information.description).toBe(
        'A test chatbot for Slack integration'
      )
      expect(manifest.features.slash_commands[0].command).toBe('/test-bot')
    })

    it('should include correct API endpoints in embedded manifest', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.settings.event_subscriptions.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/event'
      )
      expect(manifest.settings.interactivity.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/interaction'
      )
      expect(manifest.features.slash_commands[0].url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/command'
      )
    })

    it('should handle integration without name properly', () => {
      const integrationWithoutName = {
        id: 'slack-456',
        description: 'A bot without a name',
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithoutName,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.features.bot_user.display_name).toBe('ChatBotKit')
      expect(manifest.features.slash_commands[0].command).toBe('/chatbotkit')
    })

    it('should handle integration without description properly', () => {
      const integrationWithoutDescription = {
        id: 'slack-789',
        name: 'No Description Bot',
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithoutDescription,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.description).toBeUndefined()
      expect(manifest.display_information.long_description).toBeUndefined()
    })
  })

  describe('URL handling', () => {
    it('should work with different base URLs', () => {
      const testUrls = [
        'https://api.chatbotkit.com',
        'http://localhost:3000',
        'https://staging.example.com',
      ]

      testUrls.forEach((testBaseUrl) => {
        const installUrl = buildSlackManifestInstallUrl(
          basicIntegration,
          testBaseUrl
        )
        const url = new URL(installUrl)
        const manifestJson = url.searchParams.get('manifest_json')
        const manifest = JSON.parse(decodeURIComponent(manifestJson))

        expect(manifest.settings.event_subscriptions.request_url).toContain(
          testBaseUrl
        )
        expect(manifest.settings.interactivity.request_url).toContain(
          testBaseUrl
        )
        expect(manifest.features.slash_commands[0].url).toContain(testBaseUrl)
      })
    })

    it('should handle base URL with trailing slash', () => {
      const baseUrlWithSlash = 'https://api.example.com/'

      const installUrl = buildSlackManifestInstallUrl(
        basicIntegration,
        baseUrlWithSlash
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.settings.event_subscriptions.request_url).toBe(
        'https://api.example.com/api/v1/integration/slack/slack-123/event'
      )
    })

    it('should properly encode special characters in manifest JSON', () => {
      const integrationWithSpecialChars = {
        id: 'slack-special',
        name: 'Bot "with" quotes & symbols',
        description: 'A bot with special chars: <>&"\'',
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithSpecialChars,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')

      // Should be able to parse directly (searchParams.get auto-decodes)

      expect(() => {
        const manifest = JSON.parse(manifestJson)

        expect(manifest.display_information.name).toBe(
          'Bot "with" quotes & symbols'
        )
        expect(manifest.display_information.description).toBe(
          'A bot with special chars: <>&"\''
        )
      }).not.toThrow()
    })
  })

  describe('URL structure validation', () => {
    it('should always use https://api.slack.com/apps as base URL', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)

      expect(installUrl).toMatch(/^https:\/\/api\.slack\.com\/apps\?/)
    })

    it('should include required query parameters', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const url = new URL(installUrl)

      expect(url.searchParams.has('new_app')).toBe(true)
      expect(url.searchParams.has('manifest_json')).toBe(true)
      expect(url.searchParams.get('new_app')).toBe('1')
    })

    it('should create valid URLs that can be parsed', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)

      expect(() => new URL(installUrl)).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle minimal integration object', () => {
      const minimalIntegration = { id: 'slack-minimal' }

      const installUrl = buildSlackManifestInstallUrl(
        minimalIntegration,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.name).toBe('ChatBotKit')
      expect(manifest.settings.event_subscriptions.request_url).toContain(
        'slack-minimal'
      )
    })

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(500) // Very long description

      const integrationWithLongDesc = {
        id: 'slack-long',
        name: 'Long Description Bot',
        description: longDescription,
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithLongDesc,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.long_description).toBe(
        longDescription
      )
      expect(manifest.display_information.description).toBeUndefined()
    })

    it('should handle integration with null/undefined values', () => {
      const integrationWithNulls = {
        id: 'slack-nulls',
        name: null,
        description: undefined,
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithNulls,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')

      expect(() => {
        const manifest = JSON.parse(decodeURIComponent(manifestJson))

        expect(manifest.display_information.name).toBe('ChatBotKit')
      }).not.toThrow()
    })

    it('should handle complex integration IDs', () => {
      const complexId = 'slack-test_123-456.bot'

      const integrationWithComplexId = {
        id: complexId,
        name: 'Complex ID Bot',
      }

      const installUrl = buildSlackManifestInstallUrl(
        integrationWithComplexId,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.settings.event_subscriptions.request_url).toContain(
        complexId
      )
      expect(manifest.settings.interactivity.request_url).toContain(complexId)
      expect(manifest.features.slash_commands[0].url).toContain(complexId)
    })
  })

  describe('performance and reliability', () => {
    it('should handle large integration objects without errors', () => {
      const largeIntegration = {
        id: 'slack-large-test',
        name: 'A'.repeat(100), // Very long name
        description: 'B'.repeat(300), // Very long description
        extraField1: 'should be ignored',
        extraField2: { nested: 'should be ignored' },
        extraField3: [1, 2, 3, 4, 5],
      }

      expect(() => {
        const installUrl = buildSlackManifestInstallUrl(
          largeIntegration,
          baseUrl
        )
        const url = new URL(installUrl)
        const manifestJson = url.searchParams.get('manifest_json')

        JSON.parse(decodeURIComponent(manifestJson))
      }).not.toThrow()
    })

    it('should be deterministic for multiple calls', () => {
      const results = []

      for (let i = 0; i < 5; i++) {
        results.push(buildSlackManifestInstallUrl(basicIntegration, baseUrl))
      }

      // All results should be identical
      results.forEach((result) => {
        expect(result).toBe(results[0])
      })
    })

    it('should handle Unicode characters properly', () => {
      const unicodeIntegration = {
        id: 'slack-unicode',
        name: 'Bot 🤖 with émojis & spëcial chârs',
        description: 'A bot with ñice Ünicøde suppørt 💫',
      }

      const installUrl = buildSlackManifestInstallUrl(
        unicodeIntegration,
        baseUrl
      )
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.name).toBe(
        'Bot 🤖 with émojis & spëcial chârs'
      )
      expect(manifest.display_information.description).toBe(
        'A bot with ñice Ünicøde suppørt 💫'
      )
    })
  })

  describe('double encoding prevention', () => {
    it('should handle double encoding scenario properly', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)

      // Simulate double encoding that might happen in certain scenarios
      const doubleEncodedUrl = encodeURIComponent(installUrl)
      const decodedUrl = decodeURIComponent(doubleEncodedUrl)

      // The decoded URL should be the same as the original
      expect(decodedUrl).toBe(installUrl)

      // And we should still be able to parse the manifest from the decoded URL
      const url = new URL(decodedUrl)
      const manifestJson = url.searchParams.get('manifest_json')

      expect(() => {
        const manifest = JSON.parse(decodeURIComponent(manifestJson))

        expect(manifest.display_information.name).toBe('Test Bot')
      }).not.toThrow()
    })

    it('should avoid double encoding of manifest JSON parameter', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')

      // The manifest JSON should not contain any %25 sequences (double encoded %)
      expect(manifestJson).not.toContain('%25')

      // The manifest JSON should be properly single-encoded
      // but should decode without issues
      const manifest = JSON.parse(decodeURIComponent(manifestJson))

      expect(manifest.display_information.name).toBe('Test Bot')
    })

    it('should work correctly when URL is reconstructed', () => {
      const installUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)

      // Simulate the scenario where URL might be reconstructed or passed through systems
      const url = new URL(installUrl)
      const manifestParam = url.searchParams.get('manifest_json')

      // Reconstruct URL with the same parameters
      const reconstructedUrl = new URL('https://api.slack.com/apps')

      reconstructedUrl.searchParams.set('new_app', '1')
      reconstructedUrl.searchParams.set('manifest_json', manifestParam)

      // The reconstructed URL should have parseable manifest
      const finalManifestJson =
        reconstructedUrl.searchParams.get('manifest_json')

      expect(() => {
        const manifest = JSON.parse(decodeURIComponent(finalManifestJson))

        expect(manifest.display_information.name).toBe('Test Bot')
      }).not.toThrow()
    })

    it('should demonstrate the double encoding issue is fixed', () => {
      // This test demonstrates that the fix resolves the double encoding issue
      const manifest = buildSlackManifest(basicIntegration, baseUrl)
      const rawJson = JSON.stringify(manifest)

      // Our fixed approach - let URL.searchParams.set handle encoding
      const fixedUrl = buildSlackManifestInstallUrl(basicIntegration, baseUrl)
      const fixedUrlObj = new URL(fixedUrl)
      const retrievedParam = fixedUrlObj.searchParams.get('manifest_json')

      // The retrieved parameter should be the raw JSON (searchParams.get auto-decodes)
      expect(retrievedParam).toBe(rawJson)

      // And it should parse correctly without any additional decoding
      const parsedManifest = JSON.parse(retrievedParam)

      expect(parsedManifest.display_information.name).toBe('Test Bot')

      // The URL should not contain double-encoded sequences like %25
      expect(fixedUrl).not.toContain('%25')
    })

    it('should not double encode when manifest contains special characters', () => {
      const specialCharsIntegration = {
        id: 'slack-special',
        name: 'Bot "with" quotes & symbols',
        description: 'Contains special chars: <>&"\' and /slashes/',
      }

      const installUrl = buildSlackManifestInstallUrl(
        specialCharsIntegration,
        baseUrl
      )

      // URL should not contain %25 (double-encoded %)
      expect(installUrl).not.toContain('%25')

      // URL should not contain %252F (double-encoded /)
      expect(installUrl).not.toContain('%252F')

      // URL should not contain %2522 (double-encoded ")
      expect(installUrl).not.toContain('%2522')

      // But it should contain properly single-encoded characters
      expect(installUrl).toContain('%22') // encoded quote
      expect(installUrl).toContain('%2F') // encoded slash

      // Verify the manifest is still parseable
      const url = new URL(installUrl)
      const manifestJson = url.searchParams.get('manifest_json')
      const manifest = JSON.parse(manifestJson)

      expect(manifest.display_information.name).toBe(
        'Bot "with" quotes & symbols'
      )
      expect(manifest.display_information.description).toBe(
        'Contains special chars: <>&"\' and /slashes/'
      )
    })
  })
})
