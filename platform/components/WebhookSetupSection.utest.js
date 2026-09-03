import { copyTextToClipboard } from '@/components/CopyButton'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import { fireEvent, render } from '@testing-library/react'

jest.mock('@/components/CopyButton', () => ({
  copyTextToClipboard: jest.fn(),
}))

describe('WebhookSetupSection', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render without title when not provided', () => {
    const { container } = render(<WebhookSetupSection />)

    // Should not crash and should render the basic container
    expect(container.firstChild).toBeTruthy()
  })

  it('should render webhook endpoints with copy functionality', () => {
    const endpoints = [
      {
        label: 'Event URL',
        url: 'https://api.example.com/webhook/events',
        description: 'Use this URL for event subscriptions',
        required: true,
      },
      {
        label: 'Interaction URL',
        url: 'https://api.example.com/webhook/interactions',
        description: 'Use this URL for interactions',
      },
    ]

    const { getByText, getByDisplayValue } = render(
      <WebhookSetupSection endpoints={endpoints} />
    )

    // Check that labels are rendered
    expect(getByText('Event URL')).toBeTruthy()
    expect(getByText('Interaction URL')).toBeTruthy()

    // Check that required indicator is shown
    expect(getByText('*')).toBeTruthy()

    // Check that URLs are displayed in readonly inputs
    expect(
      getByDisplayValue('https://api.example.com/webhook/events')
    ).toBeTruthy()
    expect(
      getByDisplayValue('https://api.example.com/webhook/interactions')
    ).toBeTruthy()

    // Check descriptions
    expect(getByText('Use this URL for event subscriptions')).toBeTruthy()
    expect(getByText('Use this URL for interactions')).toBeTruthy()
  })

  it('should handle copy button clicks for endpoints', () => {
    const endpoints = [
      {
        label: 'Test URL',
        url: 'https://api.example.com/test',
        copyMessage: 'URL copied successfully!',
      },
    ]

    const { getByTitle } = render(<WebhookSetupSection endpoints={endpoints} />)

    const copyButton = getByTitle('Copy to clipboard')

    fireEvent.click(copyButton)

    expect(copyTextToClipboard).toHaveBeenCalledWith(
      'https://api.example.com/test',
      'URL copied successfully!'
    )
  })

  it('should render secrets with different types', () => {
    const secrets = [
      {
        name: 'apiKey',
        label: 'API Key',
        value: 'secret-key-123',
        type: 'reveal',
        description: 'Your secret API key',
        required: true,
      },
      {
        name: 'clientId',
        label: 'Client ID',
        value: 'client-123',
        placeholder: 'Enter client ID',
        description: 'Your application client ID',
      },
    ]

    const { getByText, getByDisplayValue } = render(
      <WebhookSetupSection secrets={secrets} />
    )

    // Check labels
    expect(getByText('API Key')).toBeTruthy()
    expect(getByText('Client ID')).toBeTruthy()

    // Check required indicator
    expect(getByText('*')).toBeTruthy()

    // Check that reveal type uses password input
    const apiKeyInput = getByDisplayValue('secret-key-123')

    expect(apiKeyInput.type).toBe('password')

    // Check that regular type uses text input
    const clientIdInput = getByDisplayValue('client-123')

    expect(clientIdInput.type).toBe('text')

    // Check descriptions
    expect(getByText('Your secret API key')).toBeTruthy()
    expect(getByText('Your application client ID')).toBeTruthy()
  })

  it('should handle copy button clicks for secrets', () => {
    const secrets = [
      {
        name: 'token',
        label: 'Token',
        value: 'secret-token',
        copyMessage: 'Token copied!',
      },
    ]

    const { getByTitle } = render(<WebhookSetupSection secrets={secrets} />)

    const copyButton = getByTitle('Copy to clipboard')

    fireEvent.click(copyButton)

    expect(copyTextToClipboard).toHaveBeenCalledWith(
      'secret-token',
      'Token copied!'
    )
  })

  it('should render setup instructions', () => {
    const instructions = [
      'Navigate to your application settings',
      'Find the webhook configuration section',
      'Paste the URL provided above',
    ]

    const { getByText } = render(
      <WebhookSetupSection instructions={instructions} />
    )

    expect(getByText('Setup Instructions')).toBeTruthy()
    expect(getByText('Navigate to your application settings')).toBeTruthy()
    expect(getByText('Find the webhook configuration section')).toBeTruthy()
    expect(getByText('Paste the URL provided above')).toBeTruthy()
  })

  it('should render additional children content', () => {
    const { getByTestId, getByText } = render(
      <WebhookSetupSection>
        <div data-testid="custom-content">Custom content here</div>
      </WebhookSetupSection>
    )

    expect(getByTestId('custom-content')).toBeTruthy()
    expect(getByText('Custom content here')).toBeTruthy()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <WebhookSetupSection className="custom-class" />
    )

    expect(container.firstChild.className).toContain('custom-class')
    expect(container.firstChild.className).toContain('space-y-6') // default class should also be present
  })

  it('should handle empty arrays gracefully', () => {
    const { queryByText } = render(
      <WebhookSetupSection endpoints={[]} secrets={[]} instructions={[]} />
    )

    // Should not crash and should render empty section
    expect(queryByText('Setup Instructions')).toBeFalsy()
  })

  it('should use default copy message when not provided', () => {
    const endpoints = [
      {
        label: 'Test URL',
        url: 'https://api.example.com/test',
        // No copyMessage provided
      },
    ]

    const { getByTitle } = render(<WebhookSetupSection endpoints={endpoints} />)

    const copyButton = getByTitle('Copy to clipboard')

    fireEvent.click(copyButton)

    expect(copyTextToClipboard).toHaveBeenCalledWith(
      'https://api.example.com/test',
      'Copied to clipboard'
    )
  })

  it('should not show copy button for secrets without values', () => {
    const secrets = [
      {
        name: 'emptySecret',
        label: 'Empty Secret',
        value: '', // Empty value
        placeholder: 'Enter secret',
      },
    ]

    const { queryByTitle } = render(<WebhookSetupSection secrets={secrets} />)

    // Should not show copy button when value is empty
    expect(queryByTitle('Copy to clipboard')).toBeFalsy()
  })
})
