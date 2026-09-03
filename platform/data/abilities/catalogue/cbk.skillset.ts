import { createSkillsetTemplate, field } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit skillset abilities.
 */
const abilities = {
  'conversation/skillset/install[by-id]': createSkillsetTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Skillset',
    description: 'Bring a skillset into context',
    tags: ['skillset', 'install'],
    operation: 'install',
    instruction: {
      skillsetId: field({
        name: 'skillsetId',
        description: 'the skillset ID to install',
        placeholder: true,
      }),
    },
  }),

  'conversation/skillset/uninstall[by-id]': createSkillsetTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Uninstall Skillset',
    description: 'Remove a skillset from context',
    tags: ['skillset', 'uninstall'],
    operation: 'uninstall',
    instruction: {
      skillsetId: field({
        name: 'skillsetId',
        description: 'the skillset ID to uninstall',
        placeholder: true,
      }),
    },
  }),
}

export default abilities
