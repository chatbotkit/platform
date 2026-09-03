import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: import.meta.dirname,
})

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/types/**',
      '**/.next/**',
      '**/coverage/**',
      '**/cdn/**',
    ],
  },
  ...compat.extends('@chatbotkit-dev/eslint-config'),
]

export default config
