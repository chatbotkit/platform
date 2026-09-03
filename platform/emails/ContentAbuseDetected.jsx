import * as React from 'react'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export default function ContentAbuseDetected({ conversationId, categories }) {
  return (
    <BrandedEmail preview="Content abuse has been detected in one of your conversations.">
      <Text>Dear customer,</Text>
      <Text>
        We are writing to inform you that content abuse has been detected in one
        of your conversations. The following categories have been flagged:{' '}
        {categories.join(', ')}.
      </Text>
      <Text>
        Click the button below to view the conversation details and metadata.
      </Text>
      <Button href={`${process.env.SITE_URL}/conversations/${conversationId}`}>
        View Conversation
      </Button>
      <Text>
        Best regards,
        <br />
        The ChatBotKit Team
      </Text>
    </BrandedEmail>
  )
}

ContentAbuseDetected.subject = 'ChatBotKit content abuse detected'

ContentAbuseDetected.PreviewProps = {
  conversationId: 'abc123',

  categories: [],
}
