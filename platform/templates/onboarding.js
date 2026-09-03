// @ts-check
import { resolveBuilderExperience } from '@/lib/experience'

import { getDocumentHostname } from '@/hooks/useHostname'
import { getPartnerFromDocument } from '@/hooks/usePartner'

const allSteps = [
  ':disabled',
  '/new/intent',
  '/new/goal',
  '/new/user',
  '/new/channel',
]

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'onboarding',
  icon: '✨',
  templateName: 'Onboarding',
  templateDescription: 'A multi-step onboarding process.',

  forwardButtonLastCaption: 'Save and continue',

  closable: false,

  // @note the intent step exists to pick a starter template, which is a
  // builder experience concept - on platform experience hosts the step is
  // skipped entirely. The steps are resolved lazily because the experience
  // is only known on the client (host cookie / data-audience, and the
  // partner's pinned experience via data-partner-experience).
  get steps() {
    if (typeof document === 'undefined') {
      return allSteps
    }

    const builder = resolveBuilderExperience({
      partnerExperience: getPartnerFromDocument()?.experience,
      hostname: getDocumentHostname(),
    })

    if (builder) {
      return allSteps
    }

    return allSteps.filter((step) => step !== '/new/intent')
  },

  options: {},

  values: {},

  async task({ values, fetch }) {
    const { channel, organization, industry, role, goal, intent } = values

    // @note the values are clipped to the same limits /api/v1/me/update
    // enforces so pre-seeded or stale values can never fail the save
    const { error: userUpdateError } = await fetch(`/api/v1/me/update`, {
      data: {
        channel: channel?.slice(0, 64),
        organization: organization?.slice(0, 128),
        industry: industry?.slice(0, 64),
        role: role?.slice(0, 64),
        goal: goal?.slice(0, 2048),
      },
      loadingMessage: `Saving your information and preferences...`,
      failureMessage: true,
    })

    if (userUpdateError) {
      throw new Error(userUpdateError)
    }

    // @note the intent is only set when the user went through the intent
    // step - without it there is no template to continue to, so the setup
    // ends at the dashboard
    if (!intent) {
      return {
        successMessage: 'Your information has been saved.',

        successButtonAction: '/overview',

        successButtonCaption: 'Continue to your dashboard',
      }
    }

    const templateId =
      {
        // @note 'widget-agent' is the Website Agent template id; the channel
        // intents map to their own templates, and 'example' is the Ready-Made
        // Solution template that browses and clones the examples catalogue.
        'website-agent': 'widget-agent',
        'slack-agent': 'slack-agent',
        'telegram-agent': 'telegram-agent',
        'whatsapp-agent': 'whatsapp-agent',
        'googlechat-agent': 'googlechat-agent',
        'ready-made-solution': 'example',
      }[intent] || 'widget-agent'

    return {
      successMessage:
        'Your information has been saved. Next, we will help you create the first solution that matches your goal.',

      successButtonAction: () => {
        window.location.href = `/new?template=${templateId}&from=onboarding`
      },

      successButtonCaption: 'Continue setup',
    }
  },

  hidden: true, // we hide it because there is no way to select an example at this stage
}

export default template
