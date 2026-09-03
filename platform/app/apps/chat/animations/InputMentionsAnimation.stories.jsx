/* eslint-disable import/no-anonymous-default-export */
import GlobalRoot from '@/components/GlobalRoot'

import InputMentionsAnimation from './InputMentionsAnimation'

export default {
  title: 'Apps/Chat/InputMentionsAnimation',
  component: InputMentionsAnimation,
  decorators: [
    (Story) => (
      <div className="min-h-screen p-6">
        <Story />
        <GlobalRoot />
      </div>
    ),
  ],
}

export const Default = {
  render: (args) => (
    <div className="w-[672px] mx-auto">
      <div className="border auto-border-gray-200 rounded-xl px-10">
        <InputMentionsAnimation {...args} className="h-96" />
      </div>
    </div>
  ),
}
