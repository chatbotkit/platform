import * as React from 'react'

import { BrandedEmail, Text } from '../layouts/Email'

export default function UserDeleted() {
  return (
    <BrandedEmail preview="User account deleted">
      <Text>Dear customer, 👋</Text>
      <Text>
        We&apos;re writing to inform you that your account has been deleted.
        We&apos;re sorry to see you go and we hope that you have enjoyed your
        time with us.
      </Text>
      <Text>
        If you have any questions or concerns, please get in touch with us and
        we will be happy to assist you.
      </Text>
      <Text>
        Thank you for choosing ChatBotKit. We wish you the very best in your
        future endeavors.
      </Text>
      <Text>
        Sincerely,
        <br />
        The ChatBotKit Team
      </Text>
    </BrandedEmail>
  )
}

UserDeleted.subject = 'A Farewell Message from ChatBotKit'

UserDeleted.PreviewProps = {}
