import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'
import { register } from './DataCard'

// Register the web component for Storybook
register()

/**
 * Data Card is a minimal widget for displaying structured key-value data.
 * It has no React dependency and can be used in any framework or vanilla HTML.
 */
const meta: Meta = {
  title: 'Widgets/DataCard',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A pure Web Component that displays structured data as key-value pairs. No React dependency.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Optional title displayed at the top of the card',
    },
    data: {
      control: 'object',
      description: 'Data object to display as key-value pairs',
    },
    status: {
      control: 'select',
      options: ['', 'success', 'error', 'warning', 'info'],
      description: 'Optional status indicator that changes the card styling',
    },
  },
}

export default meta

// Wrapper component to render the web component in React/Storybook
function DataCardWrapper({
  title,
  data,
  status,
}: {
  title?: string
  data?: Record<string, unknown>
  status?: string
}) {
  useEffect(() => {
    register()
  }, [])

  return (
    <mcp-data-card
      title={title}
      data={data ? JSON.stringify(data) : undefined}
      status={status}
    />
  )
}

// Declare the custom element for TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'mcp-data-card': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          title?: string
          data?: string
          status?: string
        },
        HTMLElement
      >
    }
  }
}

type Story = StoryObj<typeof DataCardWrapper>

export const Default: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    title: 'Weather Report',
    data: {
      temperature: '72°F',
      conditions: 'Sunny',
      humidity: '45%',
      wind: '5 mph NW',
    },
  },
}

export const WithStatus: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    title: 'Task Complete',
    data: {
      action: 'Email sent',
      recipient: 'user@example.com',
      timestamp: new Date().toLocaleString(),
    },
    status: 'success',
  },
}

export const ErrorState: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    title: 'Error',
    data: {
      error: 'Connection failed',
      code: 'ETIMEDOUT',
      retryIn: '30 seconds',
    },
    status: 'error',
  },
}

export const ComplexData: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    title: 'User Profile',
    data: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      isActive: true,
      loginCount: 42,
      roles: ['admin', 'editor'],
      lastLogin: '2025-12-20T10:30:00Z',
    },
  },
}

export const NoTitle: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    data: {
      key1: 'value1',
      key2: 'value2',
    },
  },
}

export const Empty: Story = {
  render: (args) => <DataCardWrapper {...args} />,
  args: {
    title: 'Empty Card',
  },
}
