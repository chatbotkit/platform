import { createTimeNowTemplate, field } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit time abilities.
 */
const abilities = {
  'time/now': createTimeNowTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Get Current Date And Time',
    description:
      'Get the current date and time in one requested format, with optional timezone override.',
    tags: ['time', 'now', 'beta'],
    commentary:
      'Defaults to the request context timezone and returns a single value in datetime, date, time, iso, or unix format.',
    instruction: {
      timezone: field({
        name: 'timezone',
        description:
          'optional IANA timezone such as UTC, America/New_York, or Europe/London',
        optional: true,
        placeholder: true,
      }),
      format: field({
        name: 'format',
        description:
          'optional output format: datetime, date, time, iso, or unix',
        optional: true,
        placeholder: true,
        enum: ['datetime', 'date', 'time', 'iso', 'unix'],
      }),
    },
  }),
}

export default abilities
