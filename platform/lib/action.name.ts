export enum ActionName {
  // verbs
  search = 'search',
  fetch = 'fetch',
  email = 'email',
  echo = 'echo',
  abort = 'abort',
  view = 'view',
  listen = 'listen',

  // nouns
  blueprint = 'blueprint',
  bot = 'bot',
  dataset = 'dataset',
  skillset = 'skillset',
  memory = 'memory',
  space = 'space',
  file = 'file',
  attachment = 'attachment',
  text = 'text',
  image = 'image',
  form = 'form',
  shell = 'shell',
  conversation = 'conversation',
  task = 'task',
  time = 'time',
  rating = 'rating',
  pack = 'pack',
  agent = 'agent',
  mcp = 'mcp',
  todo = 'todo',
  list = 'list',
}

/**
 * @doc Skillsets
 * @index 30
 *
 * ## Actions - The Building Blocks of Abilities
 *
 * Actions are the executable components within skillset abilities that perform specific tasks. Each action is specified using a markdown-style code block (fenced code block) with triple backtick notation, where you specify the action name after the first 3 backticks - similar to how you use fenced code blocks with language identifiers.
 *
 * ### Action Syntax Example
 *
 * `````markdown
 * ```fetch
 * url: https://api.example.com/data
 * method: POST
 * headers:
 *   Content-Type: application/json
 *   Authorization: Bearer ${API_KEY}
 * body:
 *   query: $[query! ys|the search query]
 * ```
 * `````
 *
 * Actions can be mixed with free-form text instructions. These instructions define how the action should be applied. It is recommended to be as descriptive as possible to ensure the action is applied consistently.
 */
