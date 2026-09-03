import * as React from 'react'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export default function UsagePolicyTriggered({
  botId,
  metric,
  threshold,
  blocked,
  blockMinutes,
}) {
  return (
    <BrandedEmail preview="A bot usage policy has been triggered.">
      <Text>Dear customer,</Text>
      <Text>
        One of your usage policies has been triggered. The bot{' '}
        <strong>{botId}</strong> reached the configured threshold of{' '}
        <strong>
          {threshold} {metric}
        </strong>{' '}
        within its policy window.
      </Text>
      {blocked ? (
        <Text>
          As a result the bot has been temporarily disabled
          {blockMinutes ? (
            <>
              {' '}
              for about <strong>{blockMinutes} minutes</strong>
            </>
          ) : null}
          . It will resume automatically once the block expires.
        </Text>
      ) : null}
      <Button href={`${process.env.SITE_URL}/bots/${botId}`}>
        View Your Bot
      </Button>
      <Text>
        If this was unexpected, review the bot&apos;s usage policy to adjust its
        threshold, window, or actions.
      </Text>
      <Text>
        Best regards,
        <br />
        ChatBotKit
      </Text>
    </BrandedEmail>
  )
}

UsagePolicyTriggered.subject = 'Usage Policy Triggered'

UsagePolicyTriggered.PreviewProps = {
  botId: 'bot_example',
  metric: 'tokens',
  threshold: 100000,
  blocked: true,
  blockMinutes: 10,
}
