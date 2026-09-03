import { ActionName } from '@/lib/action.name'

export const definitions: {
  [key in ActionName]: { description: string; examples: string[] }
} = {
  // verbs
  [ActionName.search]: {
    description: 'Searches the web or a dataset with a specific phrase',
    examples: ['@search/web', '@search/news', '@search/images'],
  },
  [ActionName.fetch]: {
    description: 'Fetches a URL with built-in timeout and retry logic',
    examples: ['@serper/web/search', '@brave/web/search', '@tavily/search'],
  },
  [ActionName.email]: {
    description: 'Sends an email to a specified recipient',
    examples: ['@email/send'],
  },
  [ActionName.echo]: {
    description: 'Echoes back a message or value',
    examples: [],
  },
  [ActionName.abort]: {
    description: 'Aborts the current operation or workflow',
    examples: [],
  },
  [ActionName.view]: {
    description: 'Uses vision model to describe an image from external URL',
    examples: ['@view/describe'],
  },
  [ActionName.listen]: {
    description: 'Listens for user input or specific events',
    examples: [],
  },

  // nouns
  [ActionName.blueprint]: {
    description: 'References a blueprint and its associated resources',
    examples: [],
  },
  [ActionName.bot]: {
    description: 'References a conversational bot configuration',
    examples: [],
  },
  [ActionName.dataset]: {
    description: 'References a dataset for searching or data retrieval',
    examples: [],
  },
  [ActionName.skillset]: {
    description: 'References a skillset with specific abilities',
    examples: [],
  },
  [ActionName.memory]: {
    description: 'Accesses stored information or conversation context',
    examples: [],
  },
  [ActionName.space]: {
    description: 'References a workspace or environment configuration',
    examples: [],
  },
  [ActionName.file]: {
    description: 'References or processes a file resource',
    examples: [],
  },
  [ActionName.attachment]: {
    description: 'Handles an attached file or resource in conversation',
    examples: [],
  },
  [ActionName.text]: {
    description: 'Generates text using input text as a prompt',
    examples: ['@text/generate', '@text/summarize', '@text/translate'],
  },
  [ActionName.image]: {
    description: 'Generates an image using input text as a prompt',
    examples: [
      '@image/generate',
      '@image/generate[gpt-image-2]',
      '@image/generate[gpt-image-1.5]',
      '@image/generate[gpt-image-1]',
    ],
  },
  [ActionName.form]: {
    description: 'Processes structured data entry from a form',
    examples: [],
  },
  [ActionName.shell]: {
    description: 'Executes a shell command or script',
    examples: ['@shell/exec', '@shell/read', '@shell/write'],
  },
  [ActionName.conversation]: {
    description: 'References or manages a conversation thread',
    examples: [],
  },
  [ActionName.task]: {
    description: 'Creates or manages a task or to-do item',
    examples: [],
  },
  [ActionName.time]: {
    description: 'Returns the current date and time',
    examples: ['@time/now'],
  },
  [ActionName.rating]: {
    description: 'Creates or manages structured ratings for bot performance',
    examples: [],
  },
  [ActionName.pack]: {
    description: 'Defines a collection of multiple abilities grouped together',
    examples: ['@pack/vanta', '@pack/vanta[vendor]'],
  },
  [ActionName.agent]: {
    description: 'Executes a task using an AI agent with specific instructions',
    examples: [
      '@perplexity/search[sonar]',
      '@agent/task/evaluate',
      '@agent/task/plan',
    ],
  },
  [ActionName.mcp]: {
    description:
      'Dynamically loads Model Context Protocol tools from external servers',
    examples: ['@mcp/load[notion]', '@mcp/load[linear]', '@mcp/load[box]'],
  },
  [ActionName.todo]: {
    description:
      'Manages a temporary todo list stored in Redis with automatic expiration',
    examples: ['@todo/read', '@todo/write', '@todo/manage'],
  },
  [ActionName.list]: {
    description:
      'Manages bot-scoped Redis lists with start/end push, pop, and paginated read operations',
    examples: ['@list/push', '@list/pop', '@list/read'],
  },
}
