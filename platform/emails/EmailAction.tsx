import * as React from 'react'

import { siteUrl } from '@/config/site'

import { BasicEmail, Markdown } from '../layouts/Email'

/**
 * Email component for action notifications
 */
export default function EmailAction({
  input,
  preview,
}: {
  input: string
  preview?: string
}): React.JSX.Element {
  return (
    <BasicEmail preview={preview}>
      <Markdown>{input}</Markdown>
      <Markdown>{`Sent from ChatBotKit (${siteUrl})`}</Markdown>
    </BasicEmail>
  )
}

EmailAction.subject = 'Email Action'

EmailAction.PreviewProps = {
  input: 'I need some support. Can you help me?',
}
