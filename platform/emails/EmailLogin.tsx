import * as React from 'react'

import type { EmailBranding } from '@/layouts/Email'

import { BrandedEmail, Text } from '../layouts/Email'

export interface EmailLoginProps {
  token: string
  branding?: EmailBranding
}

export default function EmailLogin({ token, branding }: EmailLoginProps) {
  const brand = branding?.name || 'ChatBotKit'

  return (
    <BrandedEmail
      preview="Use the code below to sign in to your account"
      branding={branding}
    >
      <Text>Dear customer,</Text>
      <Text>
        You have requested to sign in to your account. Please use the code below
        to complete the sign-in process:
      </Text>
      <Text
        style={{
          fontSize: '24px',
        }}
      >
        <strong>{token}</strong>
      </Text>
      <Text>
        If you have any questions or need assistance with the signin process,
        please don&apos;t hesitate to reach out to our support team. We are
        always available to help.
      </Text>
      <Text>
        Thank you for choosing {brand}. We look forward to continuing to serve
        you.
      </Text>
      <Text>
        Best regards,
        <br />
        {brand}
      </Text>
    </BrandedEmail>
  )
}

EmailLogin.getSubject = ({
  branding: _branding,
}: Pick<EmailLoginProps, 'branding'>) => {
  return 'Sign in to your account'
}

EmailLogin.PreviewProps = {
  token: '123456',
}
