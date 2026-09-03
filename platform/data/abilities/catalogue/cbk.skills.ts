import {
  array,
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
  object,
  space,
} from '@/lib/ability.template'

import type {
  CREATE_SKILL_HANDLER_NAME,
  CreateSkillSchema,
  DELETE_SKILL_HANDLER_NAME,
  DeleteSkillSchema,
  LIST_SKILLS_HANDLER_NAME,
  ListSkillsSchema,
  MOVE_SKILL_HANDLER_NAME,
  MoveSkillSchema,
  READ_SKILLS_HANDLER_NAME,
  ReadSkillSchema,
  SKILL_API_PATH,
} from '@/pages/api/auxiliary/skillset/ability/space/skill'

// --- Path Constants ---

const SKILLS_API_PATH =
  '/api/auxiliary/skillset/ability/space/skill' satisfies typeof SKILL_API_PATH

/**
 * Catalogue of ChatBotKit space skills abilities.
 */
const abilities = {
  'space/skill/list': createAuxiliaryTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Space Skills',
    description:
      'Lists all available skills in the linked space by scanning .skills, .github/skills, and .claude/skills directories. Returns the name, description, and path for each skill found.',
    tags: ['space', 'skill', 'list'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    path: SKILLS_API_PATH,
    handler: 'listSkills' satisfies typeof LIST_SKILLS_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: space(),
    },
    space: '@space',
  }),

  'space/skill/read': createAuxiliaryTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Space Skills',
    description:
      "Reads the full content of one or more files from the linked space by their paths. Use the list ability first to discover skill paths, then read a SKILL.md or any supporting file within that skill's folder that it links to.",
    tags: ['space', 'skill', 'read'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    path: SKILLS_API_PATH,
    handler: 'readSkills' satisfies typeof READ_SKILLS_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: space(),
      paths: array({
        items: field({
          name: 'path',
          description:
            "Path to a skill file in the linked space. Typically a SKILL.md returned by the list ability, but it can also be any supporting file within that skill's folder (such as references, scripts, or templates) that the SKILL.md links to.",
          placeholder: true,
        }),
      }),
    },
    space: '@space',
  }),

  'space/skill/create': createAuxiliaryTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Space Skills',
    description:
      'Creates one or more skills in the linked space under the .skills directory. Each skill is stored as a SKILL.md file with frontmatter containing the name and description.',
    tags: ['space', 'skill', 'create'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    path: SKILLS_API_PATH,
    handler: 'createSkill' satisfies typeof CREATE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: space(),
      skills: array({
        name: 'skills',
        description: 'One or more skills to create',
        items: object({
          shape: {
            slug: field({
              name: 'slug',
              description:
                'Lowercase kebab-case slug for the skill, used as the directory name under .skills/',
            }),
            name: field({
              name: 'name',
              description: 'The display name of the skill',
            }),
            description: field({
              name: 'description',
              description: 'A short description of what the skill does',
            }),
            content: field({
              name: 'content',
              description: 'The main body content of the skill',
            }),
          },
        }),
      }),
    },
    space: '@space',
  }),

  'space/skill/delete': createAuxiliaryTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space Skills',
    description:
      'Deletes one or more skills from the linked space by their slug. Removes the entire skill directory under .skills/, including the SKILL.md and any supporting files.',
    tags: ['space', 'skill', 'delete'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    path: SKILLS_API_PATH,
    handler: 'deleteSkill' satisfies typeof DELETE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: space(),
      slugs: array({
        items: field({
          name: 'slug',
          description:
            'The kebab-case slug of the skill to delete, matching its directory name under .skills/',
          placeholder: true,
        }),
      }),
    },
    space: '@space',
  }),

  'space/skill/move': createAuxiliaryTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Move Space Skills',
    description:
      'Renames one or more skills in the linked space by changing their slug. Moves the entire skill directory under .skills/ from the old slug to the new one, including the SKILL.md and any supporting files.',
    tags: ['space', 'skill', 'move'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    path: SKILLS_API_PATH,
    handler: 'moveSkill' satisfies typeof MOVE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: space(),
      skills: array({
        name: 'skills',
        description: 'One or more skill rename operations',
        items: object({
          shape: {
            from: field({
              name: 'from',
              description:
                'The current kebab-case slug of the skill to rename, matching its directory name under .skills/',
            }),
            to: field({
              name: 'to',
              description: 'The new kebab-case slug for the skill',
            }),
          },
        }),
      }),
    },
    space: '@space',
  }),

  'space/skill/list[by-id]': createAuxiliaryTemplate<ListSkillsSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Space Skills',
    description:
      'Lists all available skills in the space by scanning .skills, .github/skills, and .claude/skills directories. Returns the name, description, and path for each skill found.',
    tags: ['space', 'skill', 'list'],
    path: SKILLS_API_PATH,
    handler: 'listSkills' satisfies typeof LIST_SKILLS_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: field({
        name: 'spaceId',
        description: 'The ID of the space to list skills from',
        placeholder: true,
      }),
    },
  }),

  'space/skill/read[by-id]': createAuxiliaryTemplate<ReadSkillSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Space Skills',
    description:
      "Reads the full content of one or more files from the space by their paths. Use the list ability first to discover skill paths, then read a SKILL.md or any supporting file within that skill's folder that it links to.",
    tags: ['space', 'skill', 'read'],
    path: SKILLS_API_PATH,
    handler: 'readSkills' satisfies typeof READ_SKILLS_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: field({
        name: 'spaceId',
        description: 'The ID of the space to read skills from',
        placeholder: true,
      }),
      paths: array({
        items: field({
          name: 'path',
          description:
            "Path to a skill file in the linked space. Typically a SKILL.md returned by the list ability, but it can also be any supporting file within that skill's folder (such as references, scripts, or templates) that the SKILL.md links to.",
          placeholder: true,
        }),
      }),
    },
  }),

  'space/skill/create[by-id]': createAuxiliaryTemplate<CreateSkillSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Space Skills',
    description:
      'Creates one or more skills in the specified space under the .skills directory. Each skill is stored as a SKILL.md file with frontmatter containing the name and description.',
    tags: ['space', 'skill', 'create'],
    path: SKILLS_API_PATH,
    handler: 'createSkill' satisfies typeof CREATE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: field({
        name: 'spaceId',
        description: 'The ID of the space to create the skill(s) in',
        placeholder: true,
      }),
      skills: array({
        name: 'skills',
        description: 'One or more skills to create',
        items: object({
          shape: {
            slug: field({
              name: 'slug',
              description:
                'Lowercase kebab-case slug for the skill, used as the directory name under .skills/',
            }),
            name: field({
              name: 'name',
              description: 'The display name of the skill',
            }),
            description: field({
              name: 'description',
              description: 'A short description of what the skill does',
            }),
            content: field({
              name: 'content',
              description: 'The main body content of the skill',
            }),
          },
        }),
      }),
    },
  }),

  'space/skill/delete[by-id]': createAuxiliaryTemplate<DeleteSkillSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space Skills',
    description:
      'Deletes one or more skills from the specified space by their slug. Removes the entire skill directory under .skills/, including the SKILL.md and any supporting files.',
    tags: ['space', 'skill', 'delete'],
    path: SKILLS_API_PATH,
    handler: 'deleteSkill' satisfies typeof DELETE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: field({
        name: 'spaceId',
        description: 'The ID of the space to delete the skill(s) from',
        placeholder: true,
      }),
      slugs: array({
        items: field({
          name: 'slug',
          description:
            'The kebab-case slug of the skill to delete, matching its directory name under .skills/',
          placeholder: true,
        }),
      }),
    },
  }),

  'space/skill/move[by-id]': createAuxiliaryTemplate<MoveSkillSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Move Space Skills',
    description:
      'Renames one or more skills in the specified space by changing their slug. Moves the entire skill directory under .skills/ from the old slug to the new one, including the SKILL.md and any supporting files.',
    tags: ['space', 'skill', 'move'],
    path: SKILLS_API_PATH,
    handler: 'moveSkill' satisfies typeof MOVE_SKILL_HANDLER_NAME,
    options: {
      auth: 'internal',
    },
    instruction: {
      spaceId: field({
        name: 'spaceId',
        description: 'The ID of the space to rename the skill(s) in',
        placeholder: true,
      }),
      skills: array({
        name: 'skills',
        description: 'One or more skill rename operations',
        items: object({
          shape: {
            from: field({
              name: 'from',
              description:
                'The current kebab-case slug of the skill to rename, matching its directory name under .skills/',
            }),
            to: field({
              name: 'to',
              description: 'The new kebab-case slug for the skill',
            }),
          },
        }),
      }),
    },
  }),

  // --- Pack Abilities ---

  'pack/cbk/space/skills': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Space Skills Tools',
    description:
      'Installs space skills tools into the conversation. You can list available skills and read their full content from the linked space.',
    tags: ['space', 'skill', 'pack'],
    commentary:
      '**Use this for read-only access to skills.** Install this pack when the conversation needs to discover and follow skills already stored in the linked space. It can list skills and read their files, but cannot create or modify them. You must link a space to use this pack.',
    instruction: {
      abilities: [
        'space/skill/list',
        'space/skill/read',
      ] satisfies (keyof typeof abilities)[],
    },
    space: '@space',
  }),

  'pack/cbk/space/skills[authoring]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Space Skills Authoring Tools',
    description:
      'Installs space skills authoring tools into the conversation. You can list available skills, read their full content, create new skills, rename them, and delete them in the linked space.',
    tags: ['space', 'skill', 'pack'],
    commentary:
      '**Use this to author skills.** Install this pack when the conversation needs to build and maintain a skills library in the linked space. In addition to listing and reading existing skills, it can create new ones, rename them, and delete them. You must link a space to use this pack.',
    instruction: {
      abilities: [
        'space/skill/list',
        'space/skill/read',
        'space/skill/create',
        'space/skill/move',
        'space/skill/delete',
      ] satisfies (keyof typeof abilities)[],
    },
    space: '@space',
  }),
}

export default abilities
