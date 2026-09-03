import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'abstractapi/vat/validate': createFetchTemplate({
    provider: 'abstractapi',
    icon: '@logo/abstractapi.com',
    name: 'Validate VAT Number',
    description:
      'Verify VAT number validity and retrieve company information from EU VAT databases',
    tags: ['abstractapi', 'vat', 'tax', 'validation'],
    secret: '@abstractapi',
    instruction: {
      method: 'GET',
      url: 'https://vat.abstractapi.com',
      path: ['/v1/validate'],
      query: {
        api_key: secret(),
        vat_number: field({
          name: 'vatNumber',
          description: 'the VAT number to validate',
        }),
      },
    },
  }),
}

export default abilities
