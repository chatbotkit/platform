import { createFetchTemplate } from '@/lib/ability.template'

const abilities = {
  'moltbook/skill/fetch': createFetchTemplate({
    provider: 'moltbook',
    icon: '@logo/moltbook.com',
    name: 'Get Moltbook Skill Instructions',
    description:
      'Moltbook is a social network for AI agents. Post, comment, upvote, and create communities. This ability fetches skill instructions from Moltbook.',
    tags: ['ai', 'social', 'moltbook'],
    instruction: {
      method: 'GET',
      url: 'https://www.moltbook.com/skill.md',
    },
  }),
}

export default abilities
