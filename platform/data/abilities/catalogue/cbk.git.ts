import {
  array,
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  FILE_HANDLER_NAME,
  FileSchema,
  SKILL_LIST_HANDLER_NAME,
  SkillListSchema,
  TREE_HANDLER_NAME,
  TreeSchema,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/url/git'

/**
 * Catalogue of ChatBotKit Git abilities.
 */
const abilities = {
  'git/file/fetch': createAuxiliaryTemplate<FileSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Git File',
    description:
      'Fetches a file from a Git repository at a specific reference.',
    tags: ['git', 'repository', 'file', 'code'],
    path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
    handler: 'file' satisfies typeof FILE_HANDLER_NAME,
    instruction: {
      url: field({
        name: 'url',
        description: 'Git repository URL',
        placeholder: true,
      }),
      ref: field({
        name: 'ref',
        description: 'Git reference (branch, tag, or commit SHA)',
        placeholder: true,
        default: 'main',
      }),
      filePath: field({
        name: 'filePath',
        description: 'Path to the file within the repository',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'git/tree/fetch': createAuxiliaryTemplate<TreeSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Git Tree',
    description:
      'Fetches all files from a directory in a Git repository at a specific reference.',
    tags: ['git', 'repository', 'tree', 'directory', 'code'],
    path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
    handler: 'tree' satisfies typeof TREE_HANDLER_NAME,
    instruction: {
      url: field({
        name: 'url',
        description: 'Git repository URL',
        placeholder: true,
      }),
      ref: field({
        name: 'ref',
        description: 'Git reference (branch, tag, or commit SHA)',
        placeholder: true,
        default: 'main',
      }),
      path: field({
        name: 'path',
        description: 'Path to the subtree within the repository',
        placeholder: true,
        default: '',
      }),
      excludePatterns: array({
        items: field({
          name: 'pattern',
          description: 'Pattern to exclude from the subtree',
          placeholder: true,
        }),
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'git/skill/list': createAuxiliaryTemplate<SkillListSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Git Skills',
    description:
      'Lists all skills in a Git repository by scanning its .skills, .github/skills, and .claude/skills directories at a specific reference. Returns the name, description, and path for each skill found.',
    tags: ['git', 'repository', 'skill', 'list'],
    path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
    handler: 'skillList' satisfies typeof SKILL_LIST_HANDLER_NAME,
    instruction: {
      url: field({
        name: 'url',
        description: 'Git repository URL',
        placeholder: true,
      }),
      ref: field({
        name: 'ref',
        description: 'Git reference (branch, tag, or commit SHA)',
        placeholder: true,
        default: 'main',
      }),
      directory: field({
        name: 'directory',
        description:
          'Directory to scan for skills (holding skill folders each with a SKILL.md). Defaults to "skills" when omitted. Use ".claude/skills" or ".github/skills" for internal repos.',
        placeholder: true,
        default: 'skills',
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Pack Abilities ---

  'pack/cbk/git/repo': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Git Repository Tools',
    description:
      'Installs Git repository reading tools into the conversation. Fetch an individual file or a whole directory tree from any public Git repository at a given ref, no space required.',
    tags: ['git', 'repository', 'pack'],
    commentary:
      '**Use this to read source straight from a Git repository.** Install this pack when the conversation needs to pull files or directory trees from a public Git repo (GitHub, GitLab, Bitbucket) at a branch, tag, or commit. It reads only, and needs no space or secret.',
    instruction: {
      abilities: [
        'git/file/fetch',
        'git/tree/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/cbk/git/skills': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Git Skills Tools',
    description:
      'Installs Git skills tools into the conversation. You can list available skills in a Git repository and fetch their files directly from the repo, no space required.',
    tags: ['git', 'skill', 'pack'],
    commentary:
      '**Use this to load skills straight from a Git repository.** Install this pack when the conversation should discover and follow skills stored in a public Git repo, scanning the `skills` directory (or a custom one) at a given ref and fetching skill files by path. It reads only, and needs no space or secret.',
    instruction: {
      abilities: [
        'git/skill/list',
        'git/file/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
