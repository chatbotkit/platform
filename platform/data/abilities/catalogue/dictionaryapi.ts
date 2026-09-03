import { createFetchTemplate, field } from '@/lib/ability.template'

const abilities = {
  'dictionaryapi/word/fetch': createFetchTemplate({
    provider: 'dictionaryapi',
    icon: '@logo/dictionaryapi.dev',
    name: 'Get Word Definition',
    description:
      'Get comprehensive definition, pronunciation, phonetics, meanings, synonyms, antonyms, and usage examples for an English word.',
    tags: ['dictionaryapi', 'dictionary', 'definition', 'language'],
    instruction: {
      method: 'GET',
      url: 'https://api.dictionaryapi.dev',
      path: [
        '/api/v2/entries/en/',
        field({
          name: 'word',
          description: 'The English word to look up',
        }),
      ],
    },
  }),
}

export default abilities
