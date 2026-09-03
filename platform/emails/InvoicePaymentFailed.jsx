import * as React from 'react'

import { siteUrl } from '@/config/site'

import { BrandedEmail, Button, Link, Text } from '../layouts/Email'

export default function InvoicePaymentFailed() {
  return (
    <BrandedEmail preview="Your recent invoice payment has failed to process.">
      <Text>Dear customer,</Text>
      <Text>
        We were unable to process your last payment. Your card has insufficient
        funds.
      </Text>
      <Text>
        Please review your payment method, and update it if necessary to
        continue using your AI bots uninterrupted.
      </Text>
      <div>
        <Button href={`${siteUrl}/billing`}>
          Review Payment Method
        </Button>
      </div>
      <Text>
        We&apos;ll try to process your payment again in a few days. If we
        aren&apos;t able to complete your payment, your organization&apos;s{' '}
        <strong>access to premium features will be suspended</strong>.
      </Text>
      <Text>
        If you have any questions, please{' '}
        <Link href={`${siteUrl}/contact`}>contact us</Link>, and
        we&apos;ll be happy to assist.
      </Text>
      <Text>
        Best,
        <br />
        The ChatBotKit Team
      </Text>
    </BrandedEmail>
  )
}

InvoicePaymentFailed.subject = 'ChatBotKit Invoice Payment Failed'

InvoicePaymentFailed.PreviewProps = {}
