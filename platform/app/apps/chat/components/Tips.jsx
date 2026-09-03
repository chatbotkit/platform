'use client'

import { AppTip } from '@/layouts/App'

import InputMentionsAnimation from '../animations/InputMentionsAnimation'
import TextSelectionAnimation from '../animations/TextSelectionAnimation'

export function InputMentionsTip({ disabled, ...props }) {
  return (
    <AppTip
      title="Input Mentions"
      description="Learn how to interact with agents using mentions. Type @ to select an agent, # to add data sources, and ^ to choose a model."
      feature="input-mentions"
      delay={1000}
      disabled={disabled}
      {...props}
    >
      <div className="border auto-border-gray-200 rounded-xl px-10">
        <InputMentionsAnimation className="h-96" />
      </div>
    </AppTip>
  )
}

export function TextSelectionTip(props) {
  return (
    <AppTip
      title="Provide Feedback to AI"
      description="Help improve AI responses by providing feedback on specific parts of the conversation. Select any text in a message, click the feedback button, and add your comment or correction."
      feature="text-selection-feedback"
      delay={1000}
      {...props}
    >
      <div className="border auto-border-gray-200 rounded-xl px-10">
        <TextSelectionAnimation className="h-96" />
      </div>
    </AppTip>
  )
}
