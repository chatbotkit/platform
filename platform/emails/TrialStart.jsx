import * as React from 'react'

import { BrandedEmail, Button, Link, Text } from '../layouts/Email'

export default function TrialStart({ numberOfTokens }) {
  return (
    <BrandedEmail preview="We are excited to inform you that your trial period for ChatBotKit has started.">
      <Text>Dear customer,</Text>
      <Text>
        We are excited to inform you that your trial period for ChatBotKit has
        started. You have 5 days to complete the trial and explore all the
        features we offer.
      </Text>
      <Text>
        During this trial period, you have <strong>{numberOfTokens}</strong>{' '}
        number of tokens which you can use across all of our services. You will
        receive all allocated tokens after the trial period end. For more
        information on our pricing plans, please refer to our{' '}
        <Link href={`${process.env.SITE_URL}/pricing`}>pricing page</Link>.
      </Text>
      <Button href={`${process.env.SITE_URL}/usage`}>
        See your account limits
      </Button>
      <Text>
        We would like to take this opportunity to thank you for choosing
        ChatBotKit. If you have any questions or concerns, please do not
        hesitate to contact our support team.
      </Text>
      <Text>
        Best regards,
        <br />
        The ChatBotKit Team
      </Text>
    </BrandedEmail>
  )
}

TrialStart.subject = 'Your ChatBotKit Trial'

TrialStart.PreviewProps = {
  numberOfTokens: 1000,
}
