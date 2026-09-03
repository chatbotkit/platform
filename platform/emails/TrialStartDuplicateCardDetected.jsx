import * as React from 'react'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export default function TrialStartDuplicateCardDetected() {
  return (
    <BrandedEmail preview="There was a problem starting your ChatBotKit trial">
      <Text>Dear customer,</Text>
      <Text>
        We are writing to inform you that there was a problem with your
        ChatBotKit trial.
      </Text>
      <Text>
        During the onboarding process we detected that your card has been in use
        with more than one other accounts and as a result it was subsequently
        denied.
      </Text>
      <Text>
        Please reach out to your support team if believe this was done in error.{' '}
        <strong>
          You can still upgrade to any of our paid plans but a trial may not
          be available at this stage.
        </strong>
      </Text>
      <Button href={`${process.env.SITE_URL}/billing`}>
        Update your subscription
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

TrialStartDuplicateCardDetected.subject = 'Your ChatBotKit Trial'

TrialStartDuplicateCardDetected.PreviewProps = {}
