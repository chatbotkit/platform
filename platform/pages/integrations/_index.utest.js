import {
  getInstallDetails as getDiscordInstallDetails,
  getInstallPopupDetails as getDiscordInstallPopupDetails,
} from './discord/[discordIntegrationId]'
import {
  getInstallDetails as getEmailInstallDetails,
  getInstallPopupDetails as getEmailInstallPopupDetails,
} from './email/[emailIntegrationId]'
import {
  getInstallDetails as getGitHubInstallDetails,
  getInstallPopupDetails as getGitHubInstallPopupDetails,
} from './github/[githubIntegrationId]'
import {
  getInstallDetails as getGoogleChatInstallDetails,
  getInstallPopupDetails as getGoogleChatInstallPopupDetails,
} from './googlechat/[googlechatIntegrationId]'
import {
  getInstallDetails as getInstagramInstallDetails,
  getInstallPopupDetails as getInstagramInstallPopupDetails,
} from './instagram/[instagramIntegrationId]'
import {
  getInstallDetails as getMCPServerInstallDetails,
  getInstallPopupDetails as getMCPServerInstallPopupDetails,
} from './mcpserver/[mcpserverIntegrationId]'
import {
  getInstallDetails as getMessengerInstallDetails,
  getInstallPopupDetails as getMessengerInstallPopupDetails,
} from './messenger/[messengerIntegrationId]'
import {
  INSTALL_DOCS_SLUG as MICROSOFT_TEAMS_INSTALL_DOCS_SLUG,
  getInstallDetails as getMicrosoftTeamsInstallDetails,
  getInstallPopupDetails as getMicrosoftTeamsInstallPopupDetails,
} from './microsoftteams/[microsoftteamsIntegrationId]'
import {
  getInstallDetails as getRecallInstallDetails,
  getInstallPopupDetails as getRecallInstallPopupDetails,
} from './recall/[recallIntegrationId]'
import {
  getInstallDetails as getSkillServerInstallDetails,
  getInstallPopupDetails as getSkillServerInstallPopupDetails,
} from './skillserver/[skillserverIntegrationId]'
import {
  getInstallDetails as getTelegramInstallDetails,
  getInstallPopupDetails as getTelegramInstallPopupDetails,
} from './telegram/[telegramIntegrationId]'
import {
  getInstallDetails as getTriggerInstallDetails,
  getInstallPopupDetails as getTriggerInstallPopupDetails,
} from './trigger/[triggerIntegrationId]'
import {
  getInstallDetails as getTwilioInstallDetails,
  getInstallPopupDetails as getTwilioInstallPopupDetails,
} from './twilio/[twilioIntegrationId]'
import {
  getInstallDetails as getWhatsAppInstallDetails,
  getInstallPopupDetails as getWhatsAppInstallPopupDetails,
} from './whatsapp/[whatsappIntegrationId]'

const INTEGRATION = {
  id: 'integration_1',
  accessToken: 'access-token',
  secret: 'trigger-secret',
  verifyToken: 'verify-token',
  webhookSecret: 'github-secret',
}

const DETAIL_BUILDERS = [
  [
    'Discord',
    getDiscordInstallDetails,
    getDiscordInstallPopupDetails,
    [{ interactEndpoint: 'https://example.com/discord' }],
  ],
  [
    'Email',
    getEmailInstallDetails,
    getEmailInstallPopupDetails,
    [{ inbox: 'agent@example.com' }],
  ],
  [
    'GitHub',
    getGitHubInstallDetails,
    getGitHubInstallPopupDetails,
    [{ integration: INTEGRATION, eventEndpoint: 'https://example.com/github' }],
  ],
  [
    'Google Chat',
    getGoogleChatInstallDetails,
    getGoogleChatInstallPopupDetails,
    [{ eventEndpoint: 'https://example.com/google-chat' }],
  ],
  [
    'Instagram',
    getInstagramInstallDetails,
    getInstagramInstallPopupDetails,
    [{ integration: INTEGRATION, callbackEndpoint: 'https://example.com/ig' }],
  ],
  [
    'MCP Server',
    getMCPServerInstallDetails,
    getMCPServerInstallPopupDetails,
    [{ integration: INTEGRATION, type: 'general' }],
  ],
  [
    'Messenger',
    getMessengerInstallDetails,
    getMessengerInstallPopupDetails,
    [
      {
        integration: INTEGRATION,
        callbackEndpoint: 'https://example.com/messenger',
      },
    ],
  ],
  [
    'Microsoft Teams',
    getMicrosoftTeamsInstallDetails,
    getMicrosoftTeamsInstallPopupDetails,
    [{ callbackEndpoint: 'https://example.com/teams' }],
  ],
  [
    'Recall',
    getRecallInstallDetails,
    getRecallInstallPopupDetails,
    [{ integration: INTEGRATION }],
  ],
  [
    'Skill Server',
    getSkillServerInstallDetails,
    getSkillServerInstallPopupDetails,
    [{ integration: INTEGRATION, type: 'general' }],
  ],
  [
    'Telegram',
    getTelegramInstallDetails,
    getTelegramInstallPopupDetails,
    [{ webhookEndpoint: 'https://example.com/telegram' }],
  ],
  [
    'Trigger',
    getTriggerInstallDetails,
    getTriggerInstallPopupDetails,
    [{ integration: INTEGRATION, eventEndpoint: 'https://example.com/trigger' }],
  ],
  [
    'Twilio',
    getTwilioInstallDetails,
    getTwilioInstallPopupDetails,
    [{ integration: INTEGRATION }],
  ],
  [
    'WhatsApp',
    getWhatsAppInstallDetails,
    getWhatsAppInstallPopupDetails,
    [
      {
        integration: INTEGRATION,
        callbackEndpoint: 'https://example.com/whatsapp',
      },
    ],
  ],
]

describe('integration install popup details', () => {
  it.each(DETAIL_BUILDERS)(
    'should expose explicit page and popup detail builders for %s',
    (_name, getPageDetails, getPopupDetails, args) => {
      expect(getPageDetails(...args)).toBeTruthy()
      expect(getPopupDetails(...args)).toBeTruthy()
    }
  )

  it('should use the shared options-object contract for server integrations', () => {
    const mcpDetails = getMCPServerInstallPopupDetails({
      integration: INTEGRATION,
      type: 'general',
    })
    const skillDetails = getSkillServerInstallPopupDetails({
      integration: INTEGRATION,
      type: 'general',
    })

    expect(mcpDetails.code.content).toContain(INTEGRATION.id)
    expect(skillDetails.code.content).toContain(INTEGRATION.id)
  })

  it('should direct email users to close the popup before checking the event log', () => {
    const details = getEmailInstallPopupDetails({
      inbox: 'agent@example.com',
    })

    expect(details.instructions).toContain(
      'After closing these instructions, review the integration event log and adjust advanced options as needed.'
    )
    expect(details.instructions.join(' ')).not.toContain('log below')
  })

  it('should include the GitHub webhook secret in the popup', () => {
    const details = getGitHubInstallPopupDetails({
      integration: { webhookSecret: 'github-secret' },
      eventEndpoint: 'https://example.com/github/events',
    })

    expect(details.secrets).toEqual([
      expect.objectContaining({
        label: 'Webhook Secret',
        name: 'webhookSecret',
        value: 'github-secret',
        type: 'reveal',
      }),
    ])
    expect(details.instructions.join(' ')).not.toMatch(
      /configured (above|here)/i
    )
  })

  it('should direct Google Chat users back to the integration form', () => {
    const details = getGoogleChatInstallPopupDetails({
      eventEndpoint: 'https://example.com/google-chat/events',
    })

    expect(details.instructions).toContain(
      'Close these instructions, enter the service account JSON key and Project number in the integration form, and save the integration.'
    )
    expect(details.instructions.join(' ')).not.toContain('this page')
  })

  it('should use the Microsoft Teams integration docs and direct users back to the form', () => {
    const details = getMicrosoftTeamsInstallPopupDetails({
      callbackEndpoint: 'https://example.com/teams/events',
    })

    expect(MICROSOFT_TEAMS_INSTALL_DOCS_SLUG).toBe('microsoft-teams')
    expect(details.instructions).toContain(
      'Close these instructions, enter the Application ID and Application Secret in the integration form, save the integration, then click Setup.'
    )
    expect(details.instructions.join(' ')).not.toContain('this settings page')
  })

  it('should direct Telegram users back to the integration form', () => {
    const details = getTelegramInstallPopupDetails({
      webhookEndpoint: 'https://example.com/telegram/events',
    })

    expect(details.instructions).toContain(
      'Close these instructions, enter the Bot Token in the integration form, save the integration, then click Setup.'
    )
    expect(details.instructions.join(' ')).not.toContain('Bot Token above')
  })

  it('should direct trigger users to close the popup before checking events', () => {
    const details = getTriggerInstallPopupDetails({
      integration: { secret: 'trigger-secret' },
      eventEndpoint: 'https://example.com/trigger/events',
    })

    expect(details.sections.Setup.instructions).toContain(
      'After sending a test request, close these instructions and review the Trigger Integration Events section.'
    )
  })
})
