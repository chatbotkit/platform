import BackButton from './BackButton'

import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

const meta = {
  title: 'Components/BackButton',
  component: BackButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: { type: 'text' },
    },
    children: {
      control: { type: 'text' },
    },
  },
  args: { onClick: fn() },
} satisfies Meta<typeof BackButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Go Back',
    className: '',
  },
}

export const WithCustomText: Story = {
  args: {
    children: 'Return to Dashboard',
    className: '',
  },
}

export const WithCustomStyling: Story = {
  args: {
    children: 'Back to Home',
    className:
      'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg',
  },
}

export const Interactive: Story = {
  args: {
    children: 'Click me to go back',
    className: '',
    onClick: () => alert('Back button clicked!'),
  },
}
