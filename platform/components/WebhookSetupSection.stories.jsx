import WebhookSetupSection from './WebhookSetupSection'

export default {
  title: 'Components/WebhookSetupSection',
  component: WebhookSetupSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A reusable component for displaying webhook configuration information, including endpoints, secrets, and setup instructions.',
      },
    },
  },
}

export const Discord = {
  args: {
    title: 'Discord Webhook Configuration',
    description: 'Configure the interaction endpoint in your Discord application settings.',
    endpoints: [
      {
        label: 'Interaction Endpoint',
        url: 'https://api.chatbotkit.com/v1/integration/discord/example-id/interact',
        description: 'Copy the interaction endpoint above and set it up under "General Information" section of your discord application.',
        required: true,
        copyMessage: 'Discord interaction endpoint copied to clipboard',
      },
    ],
    instructions: [
      'Navigate to your Discord application in the Discord Developer Portal',
      'Go to the "General Information" section',
      'Paste the Interaction Endpoint URL above into the "Interactions Endpoint URL" field',
      'Save your application settings',
    ],
  },
}

export const Slack = {
  args: {
    title: 'Slack Webhook Configuration',
    description: 'Configure these webhook URLs in your Slack application to enable full integration functionality.',
    endpoints: [
      {
        label: 'Event Subscriptions Request URL',
        url: 'https://api.chatbotkit.com/v1/integration/slack/example-id/event',
        description: 'Set this URL in the "Event Subscriptions" section of your Slack app configuration.',
        required: true,
        copyMessage: 'Slack event subscription URL copied to clipboard',
      },
      {
        label: 'Interactivity Request URL',
        url: 'https://api.chatbotkit.com/v1/integration/slack/example-id/interaction',
        description: 'Set this URL in the "Interactivity & Shortcuts" section for interactive components.',
        required: true,
        copyMessage: 'Slack interactivity URL copied to clipboard',
      },
      {
        label: 'Slash Command URL',
        url: 'https://api.chatbotkit.com/v1/integration/slack/example-id/command',
        description: 'Set this URL for your /chatbotkit slash command.',
        required: false,
        copyMessage: 'Slack slash command URL copied to clipboard',
      },
    ],
    instructions: [
      'Navigate to your Slack app configuration at api.slack.com',
      'Go to "Event Subscriptions" and enable events, then paste the Event Subscriptions Request URL',
      'Subscribe to the required bot events: app_mention, message.channels, message.groups, message.im, message.mpim',
      'Go to "Interactivity & Shortcuts" and enable interactivity, then paste the Interactivity Request URL',
      'Go to "Slash Commands" and create a new command, then paste the Slash Command URL',
      'Save all your changes and reinstall your app to the workspace',
    ],
  },
}

export const WithSecrets = {
  args: {
    title: 'Integration Secrets',
    description: 'Configure authentication secrets for your integration.',
    secrets: [
      {
        name: 'signingSecret',
        label: 'Signing Secret',
        value: 'secret-key-12345',
        type: 'reveal',
        description: 'Your application signing secret from the Basic Information tab.',
        required: true,
        copyMessage: 'Signing secret copied to clipboard',
      },
      {
        name: 'botToken',
        label: 'Bot Token',
        value: 'xoxb-example-token',
        type: 'reveal',
        description: 'Your bot user OAuth token from the OAuth & Permissions tab.',
        required: true,
        copyMessage: 'Bot token copied to clipboard',
      },
      {
        name: 'clientId',
        label: 'Client ID',
        value: 'client-12345',
        placeholder: 'Enter your client ID',
        description: 'Your application client ID.',
        required: true,
        copyMessage: 'Client ID copied to clipboard',
      },
    ],
  },
}

export const Complete = {
  args: {
    title: 'Complete Integration Setup',
    description: 'Complete webhook and secret configuration for your integration.',
    endpoints: [
      {
        label: 'Webhook URL',
        url: 'https://api.chatbotkit.com/v1/integration/example/webhook',
        description: 'Main webhook endpoint for receiving events.',
        required: true,
        copyMessage: 'Webhook URL copied to clipboard',
      },
      {
        label: 'Callback URL',
        url: 'https://api.chatbotkit.com/v1/integration/example/callback',
        description: 'OAuth callback URL for authentication.',
        required: false,
        copyMessage: 'Callback URL copied to clipboard',
      },
    ],
    secrets: [
      {
        name: 'apiKey',
        label: 'API Key',
        value: 'sk-example-key',
        type: 'reveal',
        description: 'Your API key for authentication.',
        required: true,
        copyMessage: 'API key copied to clipboard',
      },
    ],
    instructions: [
      'Navigate to your application settings',
      'Configure the webhook URLs in the appropriate sections',
      'Enter the API key in your application configuration',
      'Test the connection to ensure everything is working',
    ],
  },
}

export const Empty = {
  args: {
    title: 'Empty Configuration',
    description: 'Example with no endpoints, secrets, or instructions.',
    endpoints: [],
    secrets: [],
    instructions: [],
  },
}

export const MinimalEndpoints = {
  args: {
    endpoints: [
      {
        label: 'Simple Endpoint',
        url: 'https://api.example.com/webhook',
        description: 'A basic webhook endpoint.',
      },
    ],
  },
}