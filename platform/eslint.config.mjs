import { FlatCompat } from '@eslint/eslintrc'

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import customRules from 'eslint-plugin-custom-eslint-rules'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: import.meta.dirname,
})

const nextConfig = nextCoreWebVitals.filter(
  ({ name }) => name !== 'next/typescript'
)

const config = [
  {
    ignores: ['**/*.d.ts'],
  },
  ...nextConfig,
  ...compat.extends('@chatbotkit-dev/eslint-config'),
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      'custom-eslint-rules': customRules,
    },
    rules: {
      'custom-eslint-rules/require-make-json-safe': 'error',
      'custom-eslint-rules/require-typed-sql': 'error',
      'custom-eslint-rules/require-safe-prisma-delete': [
        'error',
        {
          models: {
            bot: {
              deleteFunction: 'deleteBot',
              deleteManyFunction: 'deleteManyBots',
              importPath: '@/lib/bot.delete',
            },
            dataset: {
              deleteFunction: 'deleteDataset',
              deleteManyFunction: 'deleteManyDatasets',
              importPath: '@/lib/dataset.delete',
            },
            skillset: {
              deleteFunction: 'deleteSkillset',
              deleteManyFunction: 'deleteManySkillsets',
              importPath: '@/lib/skillset.delete',
            },
            space: {
              deleteFunction: 'deleteSpace',
              deleteManyFunction: 'deleteManySpaces',
              importPath: '@/lib/space.delete',
            },
            blueprint: {
              deleteFunction: 'deleteBlueprint',
              deleteManyFunction: 'deleteManyBlueprints',
              importPath: '@/lib/blueprint.delete',
            },
            conversation: {
              deleteFunction: 'deleteConversation',
              importPath: '@/lib/conversation.delete',
            },
            file: {
              deleteFunction: 'deleteFile',
              importPath: '@/lib/file.delete',
            },
            user: {
              deleteFunction: 'deleteUser',
              importPath: '@/lib/user.delete',
            },
            usage: {
              deleteFunction: 'cleanupOldUsageRecords',
              deleteManyFunction: 'cleanupOldUsageRecords',
              importPath: '@/lib/usage.cleanup',
            },
          },
        },
      ],
      'custom-eslint-rules/require-custom-use-router': 'error',
      'custom-eslint-rules/no-plain-fetch-in-routes': 'error',
      'custom-eslint-rules/no-global-fetch': 'error',
      'custom-eslint-rules/directive-first': 'error',
      'custom-eslint-rules/todo-by': 'error',
      'custom-eslint-rules/no-direct-documentation-links': 'error',
      'custom-eslint-rules/no-direct-process-env': 'error',
      'custom-eslint-rules/no-restricted-client-imports': [
        'error',
        {
          paths: [
            {
              source: '@/config/site',
              reason:
                'siteUrl and the hostnames freeze at build and ignore the serving (partner) host - use the @/hooks/useHostname family or router.absoluteHref.',
            },
            {
              source: '@/config/apexes',
              reason:
                'the apexes freeze at build - use usePortalApex/useSpaceApex from @/hooks/useHostname.',
            },
            {
              source: '@/config/origins',
              reason: 'the app origins freeze at build.',
            },
            {
              source: '@/config/hosts',
              reason: 'the host map freezes at build.',
            },
          ],
        },
      ],
      'custom-eslint-rules/require-transpiled-package': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@chatbotkit-dev/billing', '@chatbotkit-dev/billing/*'],
              message:
                'import the billing seam instead: @/lib/billing.core (facts, gates, trial policy) or @/lib/billing.provider (payment operations).',
            },
          ],
        },
      ],
      'custom-eslint-rules/require-dispose-for-factory-result': [
        'error',
        {
          factories: [
            'getStatelessConversationEngine',
            'getStatefulConversationEngine',
          ],
          disposeMethod: 'dispose',
        },
      ],
      'react/button-has-type': [
        'error',
        {
          button: true,
          submit: true,
          reset: true,
        },
      ],
      'import/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
          pattern: {
            js: 'never',
            jsx: 'never',
            ts: 'never',
            tsx: 'never',
            json: 'always',
            yaml: 'always',
            svg: 'always',
            css: 'always',
            ttf: 'always',
            woff: 'always',
            woff2: 'always',
          },
        },
      ],
      '@next/next/no-img-element': 'off',
      'no-undef': 'error',
      // @note Next 16 enables the React compiler-oriented hooks rules. Keep
      // this migration at the existing lint baseline and adopt them through
      // focused code changes instead of turning the toolchain upgrade into a
      // broad application rewrite.
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks:
            '(useFunctionHandler|useFunctionDispatch|useAborter|useDeps)',
        },
      ],
    },
  },
  {
    files: ['**/*.utest.{js,jsx,ts,tsx}'],
    rules: {
      'custom-eslint-rules/no-direct-documentation-links': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['lib/billing.*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'custom-eslint-rules/require-typed-sql': 'off',
      'custom-eslint-rules/require-transpiled-package': 'off',
    },
  },
]

export default config
