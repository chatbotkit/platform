import IntegrationInstallButton from './IntegrationInstallButton'

import { formToData } from '@/lib/form'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/DocsLink', () => ({
  __esModule: true,
  default: ({ slug, children }) => <a href={`/docs/${slug}`}>{children}</a>,
}))

// @note the jsdom test environment swaps in the node FormData, which cannot
// read a jsdom form element - same workaround as hooks/usePopup.utest.js

jest.mock('@/lib/form', () => ({
  formToData: jest.fn(() => ({})),
}))

const DETAILS = {
  endpoints: [
    {
      label: 'Interaction Endpoint',
      url: 'https://api.chatbotkit.com/v1/integration/discord/1/interact',
      required: true,
    },
  ],

  instructions: ['Navigate to the Discord Developer Portal'],
}

describe('IntegrationInstallButton', () => {
  beforeEach(() => {
    // @note the component reads the install flag off the location, so a test
    // which sets it must not leak into the one after it

    window.history.replaceState(null, '', '/integrations/discord/di1')
  })

  it('should not render the instructions until the button is clicked', () => {
    render(<IntegrationInstallButton details={DETAILS} />)

    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()

    expect(
      screen.queryByText('Navigate to the Discord Developer Portal')
    ).not.toBeInTheDocument()
  })

  it('should render the setup instructions in a popup', () => {
    render(
      <IntegrationInstallButton
        title="Discord Install Instructions"
        details={DETAILS}
        docsSlug="discord"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(screen.getByText('Discord Install Instructions')).toBeInTheDocument()

    expect(screen.getByText('Interaction Endpoint')).toBeInTheDocument()

    expect(
      screen.getByDisplayValue(
        'https://api.chatbotkit.com/v1/integration/discord/1/interact'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText('Navigate to the Discord Developer Portal')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', { name: 'integration docs' })
    ).toHaveAttribute('href', '/docs/discord')
  })

  it('should render a popup action for every link', () => {
    render(
      <IntegrationInstallButton
        details={DETAILS}
        links={[
          {
            caption: 'Open Developer Portal',
            url: 'https://discord.com/developers/applications',
            default: true,
          },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(
      screen.getByRole('button', { name: 'Open Developer Portal' })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'I am done' })
    ).toBeInTheDocument()
  })

  it('should not submit the surrounding form when used inside one', async () => {
    const handleSubmit = jest.fn((event) => event.preventDefault())

    render(
      <form onSubmit={handleSubmit}>
        <IntegrationInstallButton
          details={DETAILS}
          links={[
            {
              caption: 'Open Developer Portal',
              url: 'https://discord.com/developers/applications',
              default: true,
            },
          ]}
        />
        <button type="submit">Save</button>
      </form>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(
      screen.getByText('Navigate to the Discord Developer Portal')
    ).toBeInTheDocument()

    const openButton = screen.getByRole('button', {
      name: 'Open Developer Portal',
    })

    fireEvent.click(openButton)

    await waitFor(() => expect(openButton).toBeEnabled())

    // @note the popup is itself a form - submitting it must not bubble up the
    // react tree and save the integration behind the user's back

    const [outerForm, popupForm] = document.querySelectorAll('form')

    expect(popupForm).toBeDefined()
    expect(popupForm).not.toBe(outerForm)

    fireEvent.submit(popupForm)

    expect(handleSubmit).not.toHaveBeenCalled()
  })

  it('should open the instructions on arrival when the location carries the install flag', () => {
    // @note this is the setup checklist handing off - the user pressed
    // "Install" on the overview, so the instructions are what they came for

    window.history.replaceState(null, '', '/integrations/discord/di1?install=1')

    render(<IntegrationInstallButton details={DETAILS} />)

    expect(
      screen.getByText('Navigate to the Discord Developer Portal')
    ).toBeInTheDocument()
  })

  it('should not open the instructions on arrival without the install flag', () => {
    window.history.replaceState(null, '', '/integrations/discord/di1')

    render(<IntegrationInstallButton details={DETAILS} />)

    expect(
      screen.queryByText('Navigate to the Discord Developer Portal')
    ).not.toBeInTheDocument()
  })

  it('should let the caller hold the instructions shut against the flag', () => {
    window.history.replaceState(null, '', '/integrations/discord/di1?install=1')

    render(<IntegrationInstallButton details={DETAILS} autoOpen={false} />)

    expect(
      screen.queryByText('Navigate to the Discord Developer Portal')
    ).not.toBeInTheDocument()
  })

  it('should open the instructions on arrival when the caller asks for it', () => {
    window.history.replaceState(null, '', '/integrations/discord/di1')

    render(<IntegrationInstallButton details={DETAILS} autoOpen={true} />)

    expect(
      screen.getByText('Navigate to the Discord Developer Portal')
    ).toBeInTheDocument()
  })

  it('should build the instructions out of the form as it currently stands', () => {
    // @note this is what Slack needs - its manifest names the app after the
    // name sitting in the form, which may not be the saved one yet

    formToData.mockReturnValueOnce({ name: 'Unsaved Name' })

    render(
      <form>
        <IntegrationInstallButton
          details={(data) => ({ instructions: [`Named ${data.name}`] })}
        />
      </form>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(screen.getByText('Named Unsaved Name')).toBeInTheDocument()
  })

  it('should render an action which is not a link', async () => {
    // @note Slack copies its manifest to the clipboard rather than opening a url

    const copy = jest.fn()

    render(
      <IntegrationInstallButton
        details={DETAILS}
        actions={{ Copy: { fn: copy } }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    const copyButton = screen.getByRole('button', { name: 'Copy' })

    fireEvent.click(copyButton)

    await waitFor(() => expect(copyButton).toBeEnabled())

    expect(copy).toHaveBeenCalled()
  })

  it('should render tabbed sections when details carry sections', () => {
    render(
      <IntegrationInstallButton
        details={{
          sections: {
            Messaging: {
              title: 'Messaging',
              instructions: ['Log into the Twilio Console'],
            },

            Calls: {
              title: 'Calls',
              instructions: ['Scroll to the Voice Configuration section'],
            },
          },
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(screen.getByRole('tab', { name: 'Messaging' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calls' })).toBeInTheDocument()

    expect(screen.getByText('Log into the Twilio Console')).toBeInTheDocument()
  })
})
