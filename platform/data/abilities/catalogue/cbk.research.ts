import { createPackTemplate } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit research abilities.
 */
const abilities = {
  // @note the pack references abilities defined in cbk.search.yaml and
  // cbk.fetch.ts - pack ability keys resolve against the full catalogue at
  // install time, not against this file

  'pack/cbk/research': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Research Tools',
    description:
      'Installs web research tools into the conversation. You can search the web, search recent news, and fetch the content of a web page as text.',
    tags: ['research', 'search', 'fetch', 'pack', 'beta'],
    instruction: {
      abilities: ['search/web', 'search/news', 'fetch/text/get'],
    },
  }),
}

export default abilities
