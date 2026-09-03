import type { Meta, StoryObj } from '@storybook/react'
import { RichDataCard } from './RichDataCard'

/**
 * Rich Data Card is an enhanced React widget for displaying structured data
 * with support for titles, descriptions, sections, and status indicators.
 */
const meta: Meta<typeof RichDataCard> = {
  title: 'Widgets/RichDataCard',
  component: RichDataCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A React widget that displays structured data with rich formatting options including icons, sections, and status indicators.',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: [undefined, 'success', 'error', 'warning', 'info'],
    },
  },
}

export default meta
type Story = StoryObj<typeof RichDataCard>

export const Default: Story = {
  args: {
    title: 'Weather Report',
    icon: '🌤️',
    data: {
      temperature: '72°F',
      conditions: 'Partly Cloudy',
      humidity: '45%',
      wind: '5 mph NW',
    },
  },
}

export const WithDescription: Story = {
  args: {
    title: 'API Response',
    description: 'Data fetched from the weather service',
    icon: '📡',
    data: {
      status: 'OK',
      responseTime: '142ms',
      cached: false,
    },
  },
}

export const WithSections: Story = {
  args: {
    title: 'Order Summary',
    icon: '🛒',
    description: 'Your order has been confirmed',
    data: {
      orderId: '#12345',
      total: '$89.99',
    },
    sections: [
      {
        title: 'Shipping',
        data: {
          method: 'Express',
          estimatedDelivery: 'Dec 22, 2025',
          trackingNumber: '1Z999AA10123456784',
        },
      },
      {
        title: 'Payment',
        data: {
          method: 'Visa ****4242',
          status: 'Paid',
        },
      },
    ],
    footer: 'Thank you for your order!',
  },
}

export const SuccessStatus: Story = {
  args: {
    title: 'Email Sent',
    icon: '✓',
    status: 'success',
    data: {
      to: 'user@example.com',
      subject: 'Meeting Reminder',
      sentAt: new Date().toLocaleString(),
    },
    footer: 'Delivery confirmed',
  },
}

export const ErrorStatus: Story = {
  args: {
    title: 'Request Failed',
    icon: '⚠️',
    status: 'error',
    description: 'Unable to complete the operation',
    data: {
      error: 'Connection timeout',
      code: 'ETIMEDOUT',
      endpoint: 'api.example.com',
    },
    footer: 'Please try again later',
  },
}

export const WarningStatus: Story = {
  args: {
    title: 'Rate Limited',
    icon: '⏳',
    status: 'warning',
    data: {
      requestsRemaining: 5,
      resetIn: '60 seconds',
      limit: '100 requests/hour',
    },
  },
}

export const InfoStatus: Story = {
  args: {
    title: 'System Status',
    icon: 'ℹ️',
    status: 'info',
    data: {
      version: '2.1.0',
      uptime: '14 days',
      lastDeployment: '2025-12-15',
    },
  },
}

export const ComplexData: Story = {
  args: {
    title: 'User Profile',
    icon: '👤',
    description: 'Account details and preferences',
    data: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      isVerified: true,
      memberSince: 2023,
    },
    sections: [
      {
        title: 'Activity',
        data: {
          lastLogin: '2 hours ago',
          loginCount: 142,
          sessionsActive: 3,
        },
      },
      {
        title: 'Preferences',
        data: {
          theme: 'Dark',
          notifications: true,
          timezone: 'UTC-5',
        },
      },
    ],
  },
}

export const MinimalCard: Story = {
  args: {
    title: 'Quick Note',
    data: {
      message: 'This is a simple card with minimal content',
    },
  },
}
