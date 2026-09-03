import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'twilio/lookup/phone': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Phone Number Lookup',
    description:
      'Look up information about a phone number including carrier and caller name',
    tags: ['twilio', 'lookup', 'phone', 'validation'],
    secret: '@twilio',
    instruction: {
      method: 'GET',
      url: 'https://lookups.twilio.com',
      path: [
        '/v2/PhoneNumbers/',
        field({
          name: 'phoneNumber',
          description:
            'Phone number to look up in E.164 format e.g., +16175551212',
          placeholder: true,
        }),
      ],
      query: {
        Fields: field({
          name: 'fields',
          description:
            'Comma-separated fields to include e.g., caller_name,line_type_intelligence',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),
}

export default abilities
