import * as React from 'react'

import { BrandedEmail, Text } from '../layouts/Email'

export default function SubscriptionDeleted() {
  return (
    <BrandedEmail preview="We're sorry to see you go! It has been a pleasure serving you at ChatBotKit and we're sad to see you leave.">
      <Text>Dear customer, 👋</Text>
      <Text>
        We&apos;re sorry to see you go! It has been a pleasure serving you at
        ChatBotKit and we&apos;re sad to see you leave. We just wanted to take a
        moment to thank you for being an important part of our community.
      </Text>
      <Text>
        We understand that you may have your reasons for wanting to cancel your
        subscription with us, but we would love the opportunity to change your
        mind. May we ask you what prompted your decision to leave? Your feedback
        is important to us and it can help us to improve our service.
      </Text>
      <Text>
        We would also like to offer you a special discount to stay with us. We
        value your business and we want to make sure you&apos;re getting the
        most out of your experience with us. Please get in touch with us and we
        will be happy to share more information about this discount.
      </Text>
      <Text>
        If you have any questions or concerns, we would be happy to discuss them
        with you personally. We hope that you will reconsider your decision and
        choose to stay with us for a little while longer.
      </Text>
      <Text>
        Thank you again for choosing ChatBotKit. We wish you the very best in
        your future endeavors.
      </Text>
      <Text>
        Sincerely,
        <br />
        The ChatBotKit Team
      </Text>
      <Text>
        P.S. Please reply to this email and we will be happy to assist you.
      </Text>
    </BrandedEmail>
  )
}

SubscriptionDeleted.subject = 'A Farewell Message from ChatBotKit'

SubscriptionDeleted.PreviewProps = {}
