import { createFetchTemplate, field } from '@/lib/ability.template'

const abilities = {
  'wikipedia/summary': createFetchTemplate({
    provider: 'wikipedia',
    icon: '@logo/wikipedia.org',
    name: 'Get Wikipedia Page Summary',
    description: 'Fetch a summary of a Wikipedia page',
    tags: ['wikipedia', 'information'],
    instruction: {
      method: 'GET',
      url: 'https://en.wikipedia.org/api/rest_v1/page/summary/',
      path: [
        field({
          name: 'title',
          description: 'wikipedia page title',
          placeholder: true,
        }),
      ],
    },
  }),
}

export default abilities
