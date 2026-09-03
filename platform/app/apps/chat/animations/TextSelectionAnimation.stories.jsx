/* eslint-disable import/no-anonymous-default-export */
import GlobalRoot from '@/components/GlobalRoot'

import TextSelectionAnimation from './TextSelectionAnimation'

export default {
  title: 'Apps/Chat/TextSelectionAnimation',
  component: TextSelectionAnimation,
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
        <TextSelectionAnimation {...args} className="h-96" />
      </div>
    </div>
  ),
}
