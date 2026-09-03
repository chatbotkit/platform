import { createAgentSpawnTemplate, field } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit agent abilities.
 *
 * These abilities allow spawning sub-agents with specific roles to perform
 * tasks like evaluation, planning, and execution.
 */
const abilities = {
  /**
   * Spawns an evaluator agent to assess task completion quality.
   */
  'agent/task/evaluate': createAgentSpawnTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Evaluate Task Execution',
    description: 'Evaluate how well a task was executed by an agent',
    tags: ['agent', 'evaluate', 'beta'],
    operation: 'spawn',
    instruction: {
      backstory: field({
        name: '@backstory',
        description: 'the role and personality of the evaluator',
        default: `You are an expert evaluator. You can evaluate how well a task was executed by the agent and provide feedback on the results as well as additional instructions what to do next.`,
        placeholder: true,
      }),
      model: field({
        name: '@model',
        description: 'the model to use',
        default: 'gpt-5.5',
        placeholder: true,
        optional: true,
      }),
      instructions: field({
        name: '@instructions',
        description: 'instructions for the evaluation',
        placeholder: true,
        optional: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300000,
        optional: true,
      }),
    },
  }),

  /**
   * Spawns a planner agent to create structured execution plans.
   */
  'agent/task/plan': createAgentSpawnTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Plan Task Execution',
    description: 'Plan how a task should be executed by an agent',
    tags: ['agent', 'plan', 'beta'],
    operation: 'spawn',
    instruction: {
      backstory: field({
        name: '@backstory',
        description: 'the role and personality of the planner',
        default: `You are a task planner. You can plan how a task should be executed by the agent and provide detailed instructions on how to proceed.`,
        placeholder: true,
      }),
      model: field({
        name: '@model',
        description: 'the model to use',
        default: 'gpt-5.5',
        placeholder: true,
        optional: true,
      }),
      instructions: field({
        name: '@instructions',
        description: 'instructions for the task plan',
        placeholder: true,
        optional: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300000,
        optional: true,
      }),
    },
  }),

  /**
   * Spawns an executor agent to carry out a specific task.
   */
  'agent/execute': createAgentSpawnTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute Task',
    description: 'Execute a task using an agent',
    tags: ['agent', 'execute', 'beta'],
    operation: 'spawn',
    instruction: {
      backstory: field({
        name: 'backstory',
        description: 'the role and personality of the executor',
        default: `You must execute the following task. Failure to follow the instructions will result in unexpected outcomes and unintended consequences.`,
        placeholder: true,
      }),
      model: field({
        name: '@model',
        description: 'the model to use',
        default: 'gpt-5.5',
        placeholder: true,
        optional: true,
      }),
      instructions: field({
        name: '@instructions',
        description: 'instructions for the task execution',
        placeholder: true,
        optional: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300000,
        optional: true,
      }),
    },
  }),
}

export default abilities
