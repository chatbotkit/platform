import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    // Add Tailwind v4 plugin
    const tailwindcss = await import('@tailwindcss/vite')
    config.plugins = config.plugins || []
    config.plugins.push(tailwindcss.default())
    return config
  },
}

export default config
