import * as React from 'react'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export default function DatasetSyncCompleted({ datasetId, urls: _urls }) {
  return (
    <BrandedEmail preview="We are writing to inform you that one of your integrations has finished syncing. This means that your dataset has up-to-date records based on your configuration.">
      <Text>Dear customer,</Text>
      <Text>
        We are writing to inform you that one of your integrations has finished
        syncing. This means that your dataset has up-to-date records based on
        your configuration.
      </Text>
      <Button href={`${process.env.SITE_URL}/datasets/${datasetId}`}>
        See Dataset Records
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

DatasetSyncCompleted.subject = 'ChatBotKit Dataset sync completed'

DatasetSyncCompleted.PreviewProps = {
  datasetId: 'abc123',

  urls: [],
}
