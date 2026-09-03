import { createAuxiliaryTemplate, field, object } from '@/lib/ability.template'

import type { Schema as ScreenshotSchema } from '@/pages/api/auxiliary/skillset/ability/chatbotkit/url/screenshot'
import type { Schema as SqlSchema } from '@/pages/api/auxiliary/skillset/ability/chatbotkit/url/sql'

/**
 * Catalogue of ChatBotKit URL abilities.
 */
const abilities = {
  'url/sql': createAuxiliaryTemplate<SqlSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute File SQL Query',
    description:
      'Execute SQL queries on structured data files (CSV, Excel, JSON) to filter, aggregate, and analyze data.',
    tags: ['file', 'sql'],
    path: '/api/auxiliary/skillset/ability/chatbotkit/url/sql',
    instruction: {
      sql: field({
        name: 'sql',
        description: 'the SQL query to execute for table "table1"',
      }),
      tables: object({
        shape: {
          table1: object({
            shape: {
              url: field({
                name: 'table1_url',
                description:
                  'the url for the "table1" table where to load the data from',
                placeholder: true,
              }),
            },
          }),
        },
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'url/screenshot': createAuxiliaryTemplate<ScreenshotSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Take Screenshot',
    description:
      'Capture a screenshot of a web page from its URL and return a link to the rendered image.',
    tags: ['url', 'screenshot', 'image', 'browser', 'page'],
    path: '/api/auxiliary/skillset/ability/chatbotkit/url/screenshot',
    instruction: {
      url: field({
        name: 'url',
        description:
          'the url of the page to screenshot, including the https:// prefix',
        placeholder: true,
      }),
      fullPage: field({
        name: 'fullPage',
        description:
          'capture the entire scrollable page instead of just the visible viewport',
        type: 'boolean',
        optional: true,
      }),
      format: field({
        name: 'format',
        description: 'the image format of the screenshot',
        enum: ['png', 'jpeg', 'webp'],
        optional: true,
      }),
      viewportWidth: field({
        name: 'viewportWidth',
        description: 'the browser viewport width in pixels',
        type: 'number',
        optional: true,
      }),
      viewportHeight: field({
        name: 'viewportHeight',
        description: 'the browser viewport height in pixels',
        type: 'number',
        optional: true,
      }),
      selector: field({
        name: 'selector',
        description:
          'an optional CSS selector to capture a single element instead of the whole page',
        optional: true,
      }),
      darkMode: field({
        name: 'darkMode',
        description: 'render the page using a dark color scheme',
        type: 'boolean',
        optional: true,
      }),
      delay: field({
        name: 'delay',
        description:
          'extra time to wait in milliseconds after the page loads before capturing',
        type: 'number',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
