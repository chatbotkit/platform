import type { Meta } from '@storybook/react'

const meta = {
  title: 'Example/Welcome',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta

export const Welcome = {
  render: () => (
    <div className="max-w-2xl p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Welcome to CBK Platform Storybook
      </h1>
      <p className="text-lg text-gray-600 mb-6">
        This is a collection of UI components from the ChatBotKit platform.
        Storybook helps us develop and test components in isolation.
      </p>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900">📚 Browse Components</h3>
          <p className="text-blue-700 text-sm">
            Use the sidebar to explore existing platform components and their
            variations.
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-green-900">🎨 Test Variants</h3>
          <p className="text-green-700 text-sm">
            Use the Controls panel to test different props and states in
            real-time.
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <h3 className="font-semibold text-purple-900">📖 Documentation</h3>
          <p className="text-purple-700 text-sm">
            Each component includes auto-generated documentation and examples.
          </p>
        </div>
      </div>
    </div>
  ),
}
