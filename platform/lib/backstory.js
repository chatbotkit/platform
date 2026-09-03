// @ts-check
import { MessageType } from '@/prisma/types'

import { parseLanguageModel } from '@/lib/model.utils'
import { getRandomArrayItem } from '@/lib/random'
import { joinTrimmedNotEmpty } from '@/lib/string'
import { tryParse as parseYaml } from '@/lib/yaml'
import schema, { tryParse } from '@/lib/zod.schema'

const AgentDefinitionSchema = schema.object({
  name: schema.string().optional(),
  description: schema.string().optional(),
  model: schema
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) {
          return true
        }

        try {
          parseLanguageModel(value)

          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid language model' }
    ),
})

const DatasetDefinitionSchema = schema.union([
  schema.object({
    name: schema.string().optional(),
    description: schema.string().optional(),
    records: schema.array(
      schema.union([
        schema.string(),
        schema.object({
          text: schema.string(),
        }),
      ])
    ),
  }),
  schema.array(
    schema.union([
      schema.string(),
      schema.object({
        text: schema.string(),
      }),
    ])
  ),
])

const SkillsetDefinitionSchema = schema.union([
  schema.object({
    name: schema.string().optional(),
    description: schema.string().optional(),
    abilities: schema.array(
      schema.object({
        name: schema.string(),
        description: schema.string().optional(),
        instruction: schema.string(),
      })
    ),
  }),
  schema.array(
    schema.object({
      name: schema.string(),
      description: schema.string().optional(),
      instruction: schema.string(),
    })
  ),
])

/**
 * @param {string} section
 * @param {string[]} additional
 * @returns {readonly string[]}
 */
export function generateSectionAlternatives(section, additional = []) {
  return Object.freeze([
    `<${section}>`,
    `<|${section}|>`,
    `[[${section}]]`,
    `[${section}]`,
    ...additional,
  ])
}

export const introSections = generateSectionAlternatives('intro')
export const sceneSections = generateSectionAlternatives('scene')

export const userSections = generateSectionAlternatives('user', ['user:'])
export const botSections = generateSectionAlternatives('bot', ['bot:'])

export const contextSections = generateSectionAlternatives('context', [
  'context:',
])

export const agentSections = generateSectionAlternatives('agent')
export const datasetSections = generateSectionAlternatives('dataset')
export const skillsetSections = generateSectionAlternatives('skillset')

export const commentSections = generateSectionAlternatives('comment')

/**
 * @typedef {{
 *  text: string
 * }} Intro
 *
 * @typedef {{
 *  type: MessageType,
 *  text: string,
 *  meta: Record<string,any>
 * }} SceneMessage
 *
 * @typedef {{
 *  text: string,
 *  messages: SceneMessage[]
 * }} Scene
 *
 * @typedef {{
 *   text: string,
 *   context: string
 * }} Context
 *
 * @typedef {{
 *   name?: string,
 *   description?: string,
 *   model?: string
 * }} Agent
 *
 * @typedef {{
 *  text: string
 * }} DatasetRecord
 *
 * @typedef {{
 *   text: string,
 *   records: DatasetRecord[]
 * }} _Dataset
 *
 *  @typedef {{
 *   name?: string,
 *   description?: string,
 *   records: DatasetRecord[]
 * }} Dataset
 *
 * @typedef {{
 *   name: string,
 *   description?: string
 *   instruction: string
 * }} SkillsetAbility
 *
 * @typedef {{
 *   text: string,
 *   abilities: SkillsetAbility[]
 * }} _Skillset
 *
 *  @typedef {{
 *   name?: string,
 *   description?: string,
 *   abilities: SkillsetAbility[]
 * }} Skillset
 *
 * @typedef {{
 *  text: string,
 *  comment: string
 * }} Comment
 */

/**
 * Parse the frontmatter from the text.
 *
 * @param {string} text
 * @returns {{frontmatter: any, content: string}}
 */
export function parseFrontmatter(text) {
  text = (text || '').trim()

  if (!text.startsWith('---')) {
    return { frontmatter: null, content: text }
  }

  const lines = text.split('\n')

  let closingIndex = -1

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i

      break
    }
  }

  if (closingIndex === -1) {
    return { frontmatter: null, content: text }
  }

  const frontmatterYaml = lines.slice(1, closingIndex).join('\n')

  const content = lines
    .slice(closingIndex + 1)
    .join('\n')
    .trim()

  const frontmatter = parseYaml(frontmatterYaml)

  return { frontmatter, content }
}

/**
 * Parses the scene text and removes any user or bot sections.
 *
 * @param {string} scene
 * @returns {string}
 */
export function parseSceneText(scene) {
  scene = scene || ''

  let text = ''

  for (const line of scene.split('\n')) {
    const niceLine = line.trim().toLowerCase()

    if (userSections.some((section) => niceLine.startsWith(section))) {
      break
    }

    if (botSections.some((section) => niceLine.startsWith(section))) {
      break
    }

    text += line + '\n'
  }

  return text.trim()
}

/**
 * Parses the scene messages and extracts messages.
 *
 * @param {string} scene
 * @returns {SceneMessage[]}
 */
export function parseSceneMessages(scene) {
  scene = scene || ''

  let messages = []

  let pointer

  for (const line of scene.split('\n')) {
    const niceLine = line.trim().toLowerCase()

    let checkInline = true

    if (checkInline) {
      for (const section of userSections) {
        if (niceLine.startsWith(section)) {
          pointer = {
            text: line.substring(section.length),
            type: MessageType.user,
            meta: {},
          }

          messages.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of botSections) {
        if (niceLine.startsWith(section)) {
          pointer = {
            text: line.substring(section.length),
            type: MessageType.bot,
            meta: {},
          }

          messages.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (!checkInline) {
      continue
    }

    if (!pointer) {
      continue
    }

    pointer.text += line + '\n'
  }

  for (let message of messages) {
    message.text = message.text.trim()
  }

  return messages
}

/**
 * Parses the backstory and extracts intros and scenes.
 *
 * @param {string} backstory
 * @returns {{
 *  frontmatter: any,
 *  intros: Intro[],
 *  scenes: Scene[],
 *  contexts: Context[],
 *  agent: Agent[]
 *  datasets: Dataset[],
 *  skillsets: Skillset[],
 * }}
 */
export function parseBackstory(backstory) {
  backstory = (backstory || '').trim()

  const { frontmatter, content } = parseFrontmatter(backstory)

  backstory = content

  /** @type {Intro[]} */
  const intros = []

  /** @type {Scene[]} */
  const scenes = []

  /** @type {Context[]} */
  const contexts = []

  /** @type {{text: string}[]} */
  const _agent = []

  /** @type {Agent[]} */
  const agent = []

  /** @type {_Dataset[]} */
  const _datasets = []

  /** @type {Dataset[]} */
  const datasets = []

  /** @type {_Skillset[]} */
  const _skillsets = []

  /** @type {Skillset[]} */
  const skillsets = []

  /** @type {Comment[]} */
  const comments = []

  /** @type {Intro|Scene|Context|_Dataset|_Skillset|{text: string}|Comment} */
  let pointer = { text: '' }

  for (const line of backstory.split('\n')) {
    const niceLine = line.trim().toLowerCase()

    let checkInline = true

    if (checkInline) {
      for (const section of introSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length) }

          intros.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of sceneSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length), messages: [] }

          scenes.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of contextSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length), context: '' }

          contexts.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of datasetSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length), records: [] }

          _datasets.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of skillsetSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length), abilities: [] }

          _skillsets.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of agentSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length) }

          _agent.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (checkInline) {
      for (const section of commentSections) {
        if (niceLine.startsWith(section)) {
          pointer = { text: line.substring(section.length), comment: '' }

          comments.push(pointer)

          checkInline = false

          break
        }
      }
    }

    if (!checkInline) {
      continue
    }

    if (
      intros.length === 0 &&
      scenes.length === 0 &&
      contexts.length === 0 &&
      _datasets.length === 0 &&
      _skillsets.length === 0 &&
      _agent.length === 0 &&
      comments.length === 0
    ) {
      intros.push(pointer)
    }

    if (pointer.text === '') {
      pointer.text = line
    } else {
      pointer.text += '\n' + line
    }
  }

  // process intros

  for (const intro of intros) {
    const text = intro.text.trim()

    intro.text = text
  }

  // process scenes

  for (const scene of scenes) {
    const text = parseSceneText(scene.text)
    const messages = parseSceneMessages(scene.text)

    scene.text = text
    scene.messages = messages
  }

  // process contexts

  for (const context of contexts) {
    const text = context.text.trim()

    context.text = text
    context.context = text
  }

  // process agent

  for (const agentItem of _agent) {
    const text = agentItem.text.trim()

    const definition = tryParse(AgentDefinitionSchema, parseYaml(text))

    if (definition) {
      agent.push(definition)
    }
  }

  // process datasets

  for (const dataset of _datasets) {
    const text = dataset.text.trim()

    const definition = tryParse(DatasetDefinitionSchema, parseYaml(text))

    if (definition) {
      if (Array.isArray(definition)) {
        const records = []

        for (const item of definition) {
          if (typeof item === 'string') {
            records.push({ text: item })
          } else {
            records.push({ text: item.text })
          }
        }

        datasets.push({
          name: undefined,
          description: undefined,
          records: records,
        })
      } else {
        const records = []

        for (const item of definition.records) {
          if (typeof item === 'string') {
            records.push({ text: item })
          } else {
            records.push({ text: item.text })
          }
        }

        datasets.push({ ...definition, records })
      }
    }
  }

  // process skillsets

  for (const skillset of _skillsets) {
    const text = skillset.text.trim()

    const definition = tryParse(SkillsetDefinitionSchema, parseYaml(text))

    if (definition) {
      if (Array.isArray(definition)) {
        const abilities = []

        for (const item of definition) {
          abilities.push(item)
        }

        skillsets.push({
          name: undefined,
          description: undefined,
          abilities: abilities,
        })
      } else {
        skillsets.push(definition)
      }
    }
  }

  // process comments

  for (const comment of comments) {
    const text = comment.text.trim()

    comment.text = text
    comment.comment = text
  }

  // merge frontmatter agent if present

  if (frontmatter?.agent) {
    const frontmatterAgent = []

    if ('agent' in frontmatter) {
      const agentArray = tryParse(
        schema.array(AgentDefinitionSchema),
        frontmatter.agent
      )

      if (agentArray) {
        frontmatterAgent.push(...agentArray)
      } else {
        const agentItem = tryParse(AgentDefinitionSchema, frontmatter.agent)

        if (agentItem) {
          frontmatterAgent.push(agentItem)
        }
      }
    }

    for (const a of frontmatterAgent) {
      agent.push(a)
    }
  }

  // merge frontmatter datasets if present

  if (frontmatter?.dataset) {
    const frontmatterDatasets = []

    if ('dataset' in frontmatter) {
      const dataset = tryParse(DatasetDefinitionSchema, frontmatter.dataset)

      if (dataset) {
        frontmatterDatasets.push(dataset)
      } else {
        const datasets = tryParse(
          schema.array(DatasetDefinitionSchema),
          frontmatter.dataset
        )

        if (datasets) {
          frontmatterDatasets.push(...datasets)
        }
      }
    }

    if ('datasets' in frontmatter) {
      const datasets = tryParse(
        schema.array(DatasetDefinitionSchema),
        frontmatter.datasets
      )

      if (datasets) {
        frontmatterDatasets.push(...datasets)
      } else {
        const dataset = tryParse(DatasetDefinitionSchema, frontmatter.datasets)

        if (dataset) {
          frontmatterDatasets.push(dataset)
        }
      }
    }

    for (const ds of frontmatterDatasets) {
      if (Array.isArray(ds)) {
        const records = []

        for (const item of ds) {
          if (typeof item === 'string') {
            records.push({ text: item })
          } else {
            records.push({ text: item.text })
          }
        }

        datasets.push({
          name: undefined,
          description: undefined,
          records: records,
        })
      } else {
        const records = []

        for (const item of ds.records) {
          if (typeof item === 'string') {
            records.push({ text: item })
          } else {
            records.push({ text: item.text })
          }
        }

        datasets.push({ ...ds, records })
      }
    }
  }

  // merge frontmatter skillsets if present

  if (frontmatter?.skillset) {
    const frontmatterSkillsets = []

    if ('skillset' in frontmatter) {
      const skillset = tryParse(SkillsetDefinitionSchema, frontmatter.skillset)

      if (skillset) {
        frontmatterSkillsets.push(skillset)
      } else {
        const skillsets = tryParse(
          schema.array(SkillsetDefinitionSchema),
          frontmatter.skillset
        )

        if (skillsets) {
          frontmatterSkillsets.push(...skillsets)
        }
      }
    }

    if ('skillsets' in frontmatter) {
      const skillsets = tryParse(
        schema.array(SkillsetDefinitionSchema),
        frontmatter.skillsets
      )

      if (skillsets) {
        frontmatterSkillsets.push(...skillsets)
      } else {
        const skillset = tryParse(
          SkillsetDefinitionSchema,
          frontmatter.skillsets
        )

        if (skillset) {
          frontmatterSkillsets.push(skillset)
        }
      }
    }

    for (const ss of frontmatterSkillsets) {
      if (Array.isArray(ss)) {
        const abilities = []

        for (const item of ss) {
          abilities.push(item)
        }

        skillsets.push({
          name: undefined,
          description: undefined,
          abilities: abilities,
        })
      } else {
        skillsets.push(ss)
      }
    }
  }

  return { frontmatter, intros, scenes, contexts, datasets, skillsets, agent }
}

/**
 * Returns a random intro and scene from the backstory.
 *
 * @params {string} input
 * @param {{random?: boolean}} [options]
 * @returns {{
 *  frontmatter: any,
 *  backstory: string,
 *  messages: SceneMessage[],
 *  agent: Agent[]
 *  datasets: Dataset[],
 *  skillsets: Skillset[],
 * }}
 */
export function getSceneBackstoryAndMessages(input, options) {
  const {
    frontmatter,

    intros,

    scenes,

    contexts,

    agent,
    datasets,
    skillsets,
  } = parseBackstory(input)

  const intro = options?.random ? getRandomArrayItem(intros) : intros[0]

  const scene = options?.random ? getRandomArrayItem(scenes) : scenes[0]

  const backstory = joinTrimmedNotEmpty([intro?.text, scene?.text], '\n\n')

  const messages = scene?.messages?.slice(0) || []

  for (let context of contexts) {
    messages.unshift({
      type: MessageType.context,
      text: context.context,
      meta: {},
    })
  }

  return { frontmatter, backstory, messages, agent, datasets, skillsets }
}

/**
 * @doc Backstories
 * @description Learn about the importance of backstories in chatbot development and how they contribute to creating engaging and personalized experiences for users. Discover how multilingual chatbots can benefit from customized backstories and how conversation preempting can set the tone for conversations.
 * @category Concepts
 * @tags chatbot development, backstory, personality, conversation preempting, multilingual chatbots, engaging experiences
 * @icon heroicons/pencil
 * @index 2
 * @date Mon, Jul 14, 2025, 12:00 AM
 *
 * Backstories are an important aspect of chatbots that truly bring them to life. In simple terms, a backstory defines the overall personality and ability of the chatbot.
 *
 * Think of a backstory as the history of a character. It includes information about the chatbot's experiences, skills, and personality traits. By understanding the backstory, you can understand the chatbot's perspective and what it is trying to convey.
 *
 * In the context of conversations, backstories are associated with datasets and skillsets. Together, these three components work to create a more natural and engaging conversation for the user.
 *
 * Backstories can be customized to fit the specific needs of a chatbot. For example, a chatbot designed for customer support might have a backstory that emphasizes patience and empathy. On the other hand, a chatbot designed for entertainment might have a backstory that highlights humor and wit.
 *
 * ## Writing Backstories
 *
 * Backstories serve as natural language programming environments, providing a platform where instructions (i.e. code) can be written and understood in a language similar to our everyday speech. This innovative approach allows for a more intuitive and user-friendly programming experience, as it bridges the gap between complex programming languages and the natural language we use in our daily interactions.
 *
 * In order to craft a compelling and effective backstory, it is absolutely essential for one to have a thorough understanding of the specific tasks and functions their conversational AI bot is expected to perform. By doing so, they can create dynamic and engaging narratives that not only provide context and depth to their AI bot, but also enhance its utility and efficiency. Therefore, the process of writing a backstory becomes not only a creative endeavor but also a strategic one that directly impacts the functionality of the AI bot.
 *
 * For those interested in learning the art of writing compelling backstories, we have painstakingly crafted an in-depth tutorial for you. This comprehensive guide will provide you with the tools and techniques needed to create engaging narratives for your conversational AI agents and chatbots. By following our step-by-step approach, you can ensure your characters resonate with your audience and enrich their overall user experience. For a detailed walkthrough, please visit our tutorial [here](https://chatbotkit.com/tutorials/how-to-write-great-backstories-for-conversational-ai-agents-chatbots).
 *
 * ## Multilingual Chatbots
 *
 * When it comes to multilingual chatbots, backstories can become even more important. Understanding the cultural nuances and language intricacies of different regions can be difficult, but by crafting a backstory that is specific to a culture or language, chatbots can become more relatable and effective in their conversations. A multilingual chatbot might have different backstories for each language it speaks, allowing it to adapt to the unique needs and expectations of each region.
 *
 * For example in order to make a chatbot that speaks in French we can define the backstory in french:
 *
 * `````markdown
 * Je suis un chatbot amusant et engageant et je ne répondrai qu'en français.
 * `````
 *
 * ## Conversation Preempting
 *
 * Conversation preempting is a notable technique utilized in the design and operation of bots developed using ChatBotKit. This technique serves as a tool to establish and maintain the tone of the conversation, ensuring it adheres to the desired dialogue flow. This aspect can be finely tuned and customized within the backstory of the bot, adding a layer of depth and complexity to the bot's conversational skills. This customization is achieved through the use of conversation scenarios or **scenes**, a term commonly used within the ChatBotKit community. These scenes allow developers to craft unique and engaging conversation paths, enhancing the user-bot interaction experience.
 *
 * To create a new scene within your backstory simply use the `<|scene|>` tag like this:
 *
 * `````markdown
 * The backstory here
 *
 * <|scene|>
 * This is the beginning of the first scene.
 * `````
 *
 * Multiple scenes can be used to create a more hypothetical scenarios. Here's an example:
 *
 * `````markdown
 * The backstory here
 *
 * <|scene|>
 * This is the beginning of the first scene.
 *
 * <|scene|>
 * This is the beginning of the second scene.
 *
 * <|scene|>
 * This is the beginning of the third scene.
 *
 * `````
 *
 * In this example, the backstory includes three scenes. When the conversation begins, the chatbot will use one of the scenes at random.
 *
 * Each scene contains text which will be added to your original backstory. However, you can preempt the conversation using dialogs. Here is an example:
 *
 * `````markdown
 * The backstory here
 *
 * <|scene|>
 * Help the customer solve their problem
 *
 * user:
 * Hi there I have problem and I need your help.
 *
 * bot:
 * Aye aye captain
 * `````
 *
 * In the example above we preempt the conversation by providing a witty response which the bot will follow and try to imitate for the rest of the conversation.
 *
 * With scenes and dialogs you can create the perfect chatbot experience.
 *
 * ## Skillsets
 *
 * Although we recommend using dedicated skillsets for greater reusability, skillsets can also be created within your backstories. This approach allows for a seamless integration of specific abilities and functionalities directly into the narrative of your chatbot. The format for defining these skillsets is similar to how you define scenes, making it convenient to incorporate them into your backstory.
 *
 * By embedding skillsets within backstories, you can create more dynamic and contextually aware chatbots. For instance, if your chatbot needs to handle specific tasks or respond in certain ways based on the storyline, you can define those skillsets right within the backstory itself. This not only enhances the chatbot's performance but also ensures that the responses are consistent with its character and narrative.
 *
 * To define a skillset within a backstory, you follow a structure akin to scene creation. This makes it easy for developers to expand the bot's capabilities without having to switch contexts or manage multiple resources. Here is an example of how you can integrate a skillset within a backstory:
 *
 * `````markdown
 * The backstory here
 *
 * <|skillset|>
 * - name: Generate Image
 *   description: Generate a new image
 *   instruction: |
 *     ```image
 *     $[promt|the prompt for the image]
 *     ```
 * `````
 *
 * In summary, while dedicated skillsets offer the advantage of reusability across different chatbots, integrating skillsets within backstories provides a more cohesive and contextually relevant user experience. This dual approach allows developers to choose the best method based on the specific requirements of their chatbot.
 *
 * ## Special Fields for Dynamic Substitution
 *
 * Backstories can be more dynamic and relevant by using special fields for dynamic substitution. These special fields are placeholders that get replaced by their respective values at runtime. This is particularly useful for inserting dynamic information such as the current date, time, or contents of a specific file.
 *
 * The special fields are enclosed within `${}` brackets and can be used anywhere within the backstory. When the backstory is processed, these fields are replaced with their corresponding values. This dynamic substitution ensures that the information provided by the chatbot is always up-to-date and relevant.
 *
 * For example, if you want to include the current date in your backstory, you can use the `${EARTH_DATE}` field. Similarly, to include the current time, you can use the `${EARTH_TIME}` field. If you want to load large amounts of data into the backstory, you can use the `${FILE_id}` field, which will insert the contents of the file referenced by the id.
 *
 * Here is an example of how you can use these fields in a backstory:
 *
 * `````markdown
 * Hello, today is ${EARTH_DATE} and the current time is ${EARTH_TIME}. I have a vast knowledge of various topics, thanks to the data loaded from ${FILE_id}.
 *
 * `````
 *
 * When the backstory is used, the fields are replaced by their respective values:
 *
 * `````markdown
 * Hello, today is Mar 19, 2025 and the current time is 10:45 AM. I have a vast knowledge of various topics, thanks to the data loaded from file_123.
 *
 * `````
 *
 * Here's a table that describes each substitution:
 *
 * | Field           | Description                                                        |
 * | --------------- | ------------------------------------------------------------------ |
 * | ${EARTH_DATE}   | Replaced with the current date.                                    |
 * | ${EARTH_TIME}   | Replaced with the current time.                                    |
 * | ${ELAPSED_TIME} | Replaced with the elapsed time since the beginning of the request. |
 * | ${FILE_id}      | Replaced with the contents of the file referenced by the id.       |
 * | ${BOT_id}       | Replaced with the backstory of the bot referenced by the id.       |
 *
 * By using these special fields, you can create backstories that are engaging, personalized, and full of up-to-date dynamic information. This allows for advanced setups and makes the chatbot more useful and relevant to the user.
 *
 * **A caveat on token caching.** Dynamic substitution rewrites part of the backstory on every request. Fields like `${EARTH_TIME}` and `${ELAPSED_TIME}` change their value constantly, so the prompt sent to the model differs each time. This defeats prompt (token) caching, which relies on a stable prefix to reuse previously processed tokens. The practical effect is higher cost and latency, since the model has to reprocess the changed portion of the backstory on every turn. Use these fields where the dynamic value genuinely adds value, and prefer placing them as late in the backstory as possible so the cacheable prefix stays as long as it can.
 *
 * ## Conclusion
 *
 * In conclusion, backstories are an essential part of chatbot development that help create a more engaging and personalized experience for the user. By understanding the chatbot's backstory, users can better connect and interact with the chatbot.
 */
