import * as React from 'react'

import { joinWithAnd } from '@/lib/string'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export default function NearlyExceededDatabaseLimits({
  limits,
  upgradeAvailable = true,
}) {
  const niceLimits = limits.map((limit) => {
    const [category, value] = limit.split('/')

    return value || category
  })

  return (
    <BrandedEmail preview="Your account is close to exceeding its limits.">
      <Text>Dear customer,</Text>
      <Text>
        We hope this email finds you well. We are writing to inform you that
        your account is close to exceeding some database limits{' '}
        <strong>({joinWithAnd(niceLimits)})</strong>. As a result, you may have
        experienced some limitations with your account when making requests to
        our API.
      </Text>
      {upgradeAvailable ? (
        <Text>
          To ensure that your account remains functional and reliable, we
          encourage you to upgrade your account to a higher tier that offers
          higher limits. This will allow you to continue using our service
          without any interruptions.
        </Text>
      ) : null}
      <Button href={`${process.env.SITE_URL}/usage`}>
        See Your Account Limits
      </Button>
      <Text>
        If you have any questions or need assistance, please don&apos;t hesitate
        to reach out to our support team. We are always available to help.
      </Text>
      <Text>
        Thank you for choosing ChatBotKit. We look forward to continuing to
        serve you.
      </Text>
      <Text>
        Best regards,
        <br />
        ChatBotKit
      </Text>
    </BrandedEmail>
  )
}

NearlyExceededDatabaseLimits.subject = 'Nearly Exceeded Account Limits'

NearlyExceededDatabaseLimits.PreviewProps = {}
