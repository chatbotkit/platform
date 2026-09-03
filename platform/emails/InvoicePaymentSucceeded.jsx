import * as React from 'react'

import { siteUrl } from '@/config/site'

import { BrandedEmail, Button, Link, Text } from '../layouts/Email'

export default function InvoicePaymentSucceeded() {
  return (
    <BrandedEmail preview="Your invoice payment has been successfully processed.">
      <Text>Dear customer,</Text>
      <Text>
        We&apos;re happy to inform you that your invoice payment has been
        successfully processed.
      </Text>
      <Text>
        Thank you for your payment. Your subscription is active and you can
        continue using all premium features of your AI agents & bots.
      </Text>
      <div>
        <Button href={`${siteUrl}/billing`}>
          View Invoice Details
        </Button>
      </div>
      <Text>
        If you have any questions about your payment or subscription, please{' '}
        <Link href={`${siteUrl}/contact`}>contact us</Link>, and
        we&apos;ll be happy to assist.
      </Text>
      <Text>Thank you for choosing ChatBotKit!</Text>
      <Text>
        Best,
        <br />
        The ChatBotKit Team
      </Text>
    </BrandedEmail>
  )
}

InvoicePaymentSucceeded.subject = 'ChatBotKit Invoice Payment Succeeded'

InvoicePaymentSucceeded.PreviewProps = {}
