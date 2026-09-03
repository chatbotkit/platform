import type {
  AnyImageModel,
  AnyLanguageModel,
  AnyRerankModel,
  AnySpeechToTextModel,
  AnyTextToSpeechModel,
  AnyVideoModel,
  BedrockLanguageModel,
  ChatBotKitLanguageModel,
  CloudflareLanguageModel,
  DeepseekLanguageModel,
  GroqLanguageModel,
  MistralLanguageModel,
  OpenAILanguageModel,
  OpenrouterLanguageModel,
  PerplexityLanguageModel,
  VercelLanguageModel,
  VertexLanguageModel,
} from '@/lib/model.types'

// @note availability is a server-side, runtime question: a provider's models
// are served only when its credential exists in the environment. The browser
// compiles the full catalogue as metadata; what a deployment actually offers
// reaches it through the platform model list API
// (hooks/useAvailableLanguageModels).

// @note jsdom-based unit tests also have a window; they must keep the
// server-side credential gate or live-only suites become eligible without keys
const IS_BROWSER =
  typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'

const WITH_OPENAI_MODELS =
  IS_BROWSER ||
  !!(process.env.OPENAI_MODELS_API_KEY || process.env.OPENAI_API_KEY)

const WITH_OPENROUTER_MODELS =
  IS_BROWSER || !!process.env.OPENROUTER_MODELS_API_KEY

const WITH_VERTEX_MODELS = IS_BROWSER || !!process.env.VERTEX_MODELS_API_KEY

const WITH_BEDROCK_MODELS = IS_BROWSER || !!process.env.BEDROCK_MODELS_API_KEY

const WITH_VERCEL_MODELS = IS_BROWSER || !!process.env.VERCEL_MODELS_API_KEY

const WITH_CLOUDFLARE_MODELS =
  IS_BROWSER ||
  (!!process.env.CLOUDFLARE_MODELS_ACCOUNT_ID &&
    !!process.env.CLOUDFLARE_MODELS_API_KEY)

const WITH_PERPLEXITY_MODELS =
  IS_BROWSER || !!process.env.PERPLEXITY_MODELS_API_KEY

const WITH_MISTRAL_MODELS = IS_BROWSER || !!process.env.MISTRAL_MODELS_API_KEY

const WITH_GROQ_MODELS = IS_BROWSER || !!process.env.GROQ_MODELS_API_KEY

const WITH_DEEPSEEK_MODELS = IS_BROWSER || !!process.env.DEEPSEEK_MODELS_API_KEY

// @note these aliases carry no constraint of their own; they exist so a
// catalogue's keys read as what they are. They came across from the JSDoc
// typedefs this file used before it was TypeScript.

type OpenAILanguageModelName = string
type OpenrouterLanguageModelName = string
type VertexLanguageModelName = string
type BedrockLanguageModelName = string
type VercelLanguageModelName = string
type CloudflareLanguageModelName = string
type PerplexityLanguageModelName = string
type MistralLanguageModelName = string
type GroqLanguageModelName = string
type DeepseekLanguageModelName = string
type ChatBotKitLanguageModelName = string

const ONE_T = 1000
const ONE_K = 1024

const MAX_INPUT_TOKENS_RATIO = 3 / 4
const MAX_OUTPUT_TOKENS_RATIO = 1 / 4

const DEFAULT_TEMPERATURE = 0

const DEFAULT_INTERACTION_MAX_MESSAGES = 100

// ---
// ---
// ---

// ---
// ---
// ---

export const openaiLanguageModels: Record<
  OpenAILanguageModelName,
  OpenAILanguageModel
> = WITH_OPENAI_MODELS
  ? {
      // GPT Realtime
      'gpt-realtime-2.1': {
        description: `GPT Realtime 2.1 is OpenAI's latest realtime reasoning model, with improved alphanumeric recognition, silence and noise handling, and interruption behavior for complex voice-agent workflows.`,

        provider: 'openai',

        family: 'gpt-realtime',

        features: ['chat', 'functions', 'image', 'reasoning', 'realtime'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128_000,
        maxInputTokens: 96_000,
        maxOutputTokens: 32_000,

        pricing: {
          tokenRatio: 1.3333,
          inputTokenRatio: 0.2857,
          outputTokenRatio: 1.3333,
          inputPrice: 4.0,
          outputPrice: 24.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        voice: 'marin',
        availableVoices: [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ],

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-06',
      },

      'gpt-realtime-2.1-mini': {
        description: `GPT Realtime 2.1 mini is OpenAI's faster, lower-cost distilled realtime reasoning model, with improved alphanumeric recognition for responsive voice applications.`,

        provider: 'openai',

        family: 'gpt-realtime',

        features: ['chat', 'functions', 'image', 'reasoning', 'realtime'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128_000,
        maxInputTokens: 96_000,
        maxOutputTokens: 32_000,

        pricing: {
          tokenRatio: 0.1333,
          inputTokenRatio: 0.0429,
          outputTokenRatio: 0.1333,
          inputPrice: 0.6,
          outputPrice: 2.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        voice: 'marin',
        availableVoices: [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ],

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-06',
      },

      'gpt-realtime-2': {
        description: `GPT Realtime 2 is an OpenAI realtime reasoning model with configurable reasoning effort, strong instruction following, and reliable tool use for complex voice-agent workflows.`,

        provider: 'openai',

        family: 'gpt-realtime',

        features: ['chat', 'functions', 'image', 'reasoning', 'realtime'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128_000,
        maxInputTokens: 96_000,
        maxOutputTokens: 32_000,

        pricing: {
          tokenRatio: 1.3333,
          inputTokenRatio: 0.2857,
          outputTokenRatio: 1.3333,
          inputPrice: 4.0,
          outputPrice: 24.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        voice: 'marin',
        availableVoices: [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ],

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-07',
      },

      'gpt-realtime-1.5': {
        description: `GPT Realtime 1.5 is OpenAI's flagship audio model for voice agents and customer support, supporting realtime audio and text conversations with tool use.`,

        provider: 'openai',

        family: 'gpt-realtime',

        features: ['chat', 'functions', 'image', 'realtime'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 32_000,
        maxInputTokens: 27_904,
        maxOutputTokens: 4_096,

        pricing: {
          tokenRatio: 0.8889,
          inputTokenRatio: 0.2857,
          outputTokenRatio: 0.8889,
          inputPrice: 4.0,
          outputPrice: 16.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        voice: 'marin',
        availableVoices: [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ],

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-23',
      },

      'gpt-realtime-mini': {
        description: `GPT Realtime mini is OpenAI's cost-efficient realtime model for responsive audio and text conversations over WebRTC, WebSocket, or SIP connections.`,

        provider: 'openai',

        family: 'gpt-realtime',

        features: ['chat', 'functions', 'image', 'realtime'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 32_000,
        maxInputTokens: 27_904,
        maxOutputTokens: 4_096,

        pricing: {
          tokenRatio: 0.1333,
          inputTokenRatio: 0.0429,
          outputTokenRatio: 0.1333,
          inputPrice: 0.6,
          outputPrice: 2.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        voice: 'marin',
        availableVoices: [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ],

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-10-06',
      },

      // GPT-5
      'gpt-5.6-sol': {
        description: `GPT-5.6 Sol is OpenAI's newest frontier model for the most complex professional work, leading the GPT-5.6 series with advanced reasoning and the strongest coding performance for high-stakes tasks.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        featured: true,

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.6667,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.6667,
          inputPrice: 5.0,
          outputPrice: 30.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-09',
      },

      'gpt-5.6-terra': {
        description: `GPT-5.6 Terra is the balanced member of the GPT-5.6 series, pairing near-frontier intelligence with significantly lower cost for everyday professional workloads.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        featured: true,

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.6667,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.6667,
          inputPrice: 2,
          outputPrice: 12.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-09',
      },

      'gpt-5.6-luna': {
        description: `GPT-5.6 Luna is the most cost-efficient member of the GPT-5.6 series, designed for cost-sensitive, high-volume tasks like classification, data extraction, ranking, and sub-agents.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0667,
          inputTokenRatio: 0.0143,
          outputTokenRatio: 0.0667,
          inputPrice: 0.2,
          outputPrice: 1.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-09',
      },

      'gpt-5.5': {
        description: `GPT-5.5 is OpenAI's newest frontier model for the most complex professional work, offering stronger coding performance and advanced reasoning for high-stakes tasks.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.6667,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.6667,
          inputPrice: 5.0,
          outputPrice: 30.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-23',
      },

      'gpt-5.4-mini': {
        description: `GPT-5.4 mini is OpenAI's strongest mini model for coding, computer use, and subagents, bringing the strengths of GPT-5.4 to a faster, more efficient model designed for high-volume workloads.`,

        provider: 'openai',

        family: 'gpt-5',

        // @note 'responses' routes this model through the OpenAI Responses
        // API (/v1/responses) instead of /v1/chat/completions, so it can
        // combine tools with a reasoning effort

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        featured: true,

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.25,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.25,
          inputPrice: 0.75,
          outputPrice: 4.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-17',
      },

      'gpt-5.4-nano': {
        description: `GPT-5.4 nano is OpenAI's cheapest GPT-5.4-class model for simple high-volume tasks like classification, data extraction, ranking, and sub-agents.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0694,
          inputTokenRatio: 0.0143,
          outputTokenRatio: 0.0694,
          inputPrice: 0.2,
          outputPrice: 1.25,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-17',
      },

      'gpt-5.4-pro': {
        description: `GPT-5.4 pro is a version of GPT-5.4 that uses more compute to think harder and provide consistently smarter and more precise responses for complex professional tasks.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 10.0,
          inputTokenRatio: 2.1429,
          outputTokenRatio: 10.0,
          inputPrice: 30.0,
          outputPrice: 180.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-05',
      },

      'gpt-5.4': {
        description: `GPT-5.4 is OpenAI's frontier model for complex professional work, offering the highest capability in the GPT-5 series with a 1M+ context window and advanced reasoning.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us', 'eu'],

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.1786,
          outputTokenRatio: 0.8333,
          inputPrice: 2.5,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-05',
      },

      'gpt-5.2': {
        description: `GPT-5.2 is the fast, lightweight member of the 5.2 family, optimized for low-latency chat while retaining strong general intelligence.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.7778,
          inputTokenRatio: 0.125,
          outputTokenRatio: 0.7778,
          inputPrice: 1.75,
          outputPrice: 14.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-12-11',
      },

      'gpt-5.1': {
        description: `GPT-5.1 is the latest frontier-grade model in the GPT-5 series, offering stronger general-purpose reasoning, improved instruction adherence, and a more natural conversational style compared to GPT-5.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-11-20',
      },

      'gpt-5': {
        description: `GPT-5 is the next generation language model with enhanced reasoning capabilities and improved performance across all domains including coding, mathematics, science, and creative tasks.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-08-07',
      },

      'gpt-5-mini': {
        description: `GPT-5 Mini is the cost-efficient version of GPT-5, offering excellent performance for most tasks while being faster and more affordable than GPT-5.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.1111,
          inputTokenRatio: 0.0179,
          outputTokenRatio: 0.1111,
          inputPrice: 0.25,
          outputPrice: 2.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-08-07',
      },

      'gpt-5-nano': {
        description: `GPT-5 Nano is the most lightweight and fastest model in the GPT-5 family, optimized for simple tasks requiring quick responses with minimal computational overhead.`,

        provider: 'openai',

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning', 'responses'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.0036,
          outputTokenRatio: 0.0222,
          inputPrice: 0.05,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-08-07',
      },

      // o4
      'o4-mini': {
        description: `o4-mini is the latest small o-series model. It's optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.`,

        provider: 'openai',

        family: 'o4',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 200_000,
        maxInputTokens: 200_000 - 100_000,
        maxOutputTokens: 100_000,

        pricing: {
          tokenRatio: 0.2444,
          inputTokenRatio: 0.0786,
          outputTokenRatio: 0.2444,
          inputPrice: 1.1,
          outputPrice: 4.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-17',
      },

      // o3
      o3: {
        description: `o3 is a well-rounded and powerful model across domains. It sets a new standard for math, science, coding, and visual reasoning tasks. It also excels at technical writing and instruction-following.`,

        provider: 'openai',

        family: 'o3',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 200_000 - 100_000,
        maxOutputTokens: 100_000,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],
      },

      'o3-mini': {
        description: `o3-mini is a cost-efficient reasoning model that's optimized for coding, math, and science, and supports tools and Structured Outputs.`,

        provider: 'openai',

        family: 'o3',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200 * ONE_T,
        maxInputTokens: 100 * ONE_T,
        maxOutputTokens: 100 * ONE_T,

        pricing: {
          tokenRatio: 0.2444,
          inputTokenRatio: 0.0786,
          outputTokenRatio: 0.2444,
          inputPrice: 1.1,
          outputPrice: 4.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-01-31',
      },

      // o1
      o1: {
        description: `o1 is a powerful reasoning model that supports tools, Structured Outputs, and vision. The model has 200K context and an October 2023 knowledge cutoff.`,

        provider: 'openai',

        family: 'o1',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128 * ONE_T,
        maxInputTokens: (128 - 4) * ONE_T,
        maxOutputTokens: 4 * ONE_T,

        pricing: {
          tokenRatio: 3.3333,
          inputTokenRatio: 1.0714,
          outputTokenRatio: 3.3333,
          inputPrice: 15.0,
          outputPrice: 60.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],
      },

      // GPT-4.1
      'gpt-4.1-nano': {
        description: `GPT-4.1 nano is the fastest, most cost-effective GPT 4.1 model.`,

        provider: 'openai',

        family: 'gpt-4.1',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_047_576,
        maxInputTokens: 1_047_576 - 32_768,
        maxOutputTokens: 32_768,

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0222,
          inputPrice: 0.1,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-14',
      },

      'gpt-4.1-mini': {
        description: `GPT 4.1 mini provides a balance between intelligence, speed, and cost that makes it an attractive model for many use cases.`,

        provider: 'openai',

        family: 'gpt-4.1',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_047_576,
        maxInputTokens: 1_047_576 - 32_768,
        maxOutputTokens: 32_768,

        pricing: {
          tokenRatio: 0.0889,
          inputTokenRatio: 0.0286,
          outputTokenRatio: 0.0889,
          inputPrice: 0.4,
          outputPrice: 1.6,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-14',
      },

      'gpt-4.1': {
        description: `GPT 4.1 is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.`,

        provider: 'openai',

        family: 'gpt-4.1',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_047_576,
        maxInputTokens: 1_047_576 - 32_768,
        maxOutputTokens: 32_768,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-14',
      },

      // GPT-4.5
      'gpt-4.5': {
        description: `GPT-4.5 excels at tasks that benefit from creative, open-ended thinking and conversation, such as writing, learning, or exploring new ideas.`,

        provider: 'openai',

        family: 'gpt-4.5',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128 * ONE_T,
        maxInputTokens: (128 - 16) * ONE_T,
        maxOutputTokens: 16 * ONE_T,

        pricing: {
          tokenRatio: 8.3333,
          inputTokenRatio: 5.3571,
          outputTokenRatio: 8.3333,
          inputPrice: 75.0,
          outputPrice: 150.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-02-27',
      },

      // GPT-4o
      'gpt-4o-mini': {
        description: `GPT-4o mini is OpenAI's most cost-efficient small model that's smarter and cheaper than GPT-3.5 Turbo, and has vision capabilities. The model has 128K context and an October 2023 knowledge cutoff.`,

        provider: 'openai',

        family: 'gpt-4o',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128 * ONE_T,
        maxInputTokens: (128 - 4) * ONE_T,
        maxOutputTokens: 4 * ONE_T,

        pricing: {
          tokenRatio: 0.0333,
          inputTokenRatio: 0.0107,
          outputTokenRatio: 0.0333,
          inputPrice: 0.15,
          outputPrice: 0.6,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-07-19',
      },

      'gpt-4o': {
        description: `GPT-4o is faster and cheaper than GPT-4 Turbo with stronger vision capabilities. The model has 128K context and an October 2023 knowledge cutoff.`,

        provider: 'openai',

        family: 'gpt-4o',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128 * ONE_T,
        maxInputTokens: (128 - 4) * ONE_T,
        maxOutputTokens: 4 * ONE_T,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 0.8333,
          inputPrice: 5.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-05-13',
      },

      // GPT-4 Turbo
      'gpt-4-turbo': {
        description: `GPT-4 Turbo is offered at 128K context with an April 2023 knowledge cutoff and basic support for vision.`,

        provider: 'openai',

        family: 'gpt-4-turbo',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128 * ONE_T,
        maxInputTokens: (128 - 4) * ONE_T,
        maxOutputTokens: 4 * ONE_T,

        pricing: {
          tokenRatio: 1.6667,
          inputTokenRatio: 0.7143,
          outputTokenRatio: 1.6667,
          inputPrice: 10.0,
          outputPrice: 30.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-01-27',
      },

      // GPT-4
      'gpt-4': {
        description: `The GPT-4 model was built with broad general knowledge and domain expertise. `,

        provider: 'openai',

        family: 'gpt-4',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 8 * ONE_K,
        maxInputTokens: Math.floor(8 * ONE_K * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(8 * ONE_K * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 3.3333,
          inputTokenRatio: 2.1429,
          outputTokenRatio: 3.3333,
          inputPrice: 30.0,
          outputPrice: 60.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 0.7,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-01-27',
      },

      // GPT-3.5 Turbo
      'gpt-3.5-turbo': {
        description: `GPT-3.5 Turbo is fast and inexpensive model for simpler tasks.`,

        provider: 'openai',

        family: 'gpt-3.5-turbo',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 16 * ONE_K,
        maxInputTokens: Math.floor(16 * ONE_K * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(16 * ONE_K * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0833,
          inputTokenRatio: 0.0357,
          outputTokenRatio: 0.0833,
          inputPrice: 0.5,
          outputPrice: 1.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 0.7,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-01-27',
      },

      'gpt-3.5-turbo-instruct': {
        description: `GPT-3.5 Turbo is fast and inexpensive model for simpler tasks.`,

        provider: 'openai',

        family: 'gpt-3.5-turbo',

        features: [],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 4 * ONE_K,
        maxInputTokens: Math.floor(4 * ONE_K * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(4 * ONE_K * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.1111,
          inputTokenRatio: 0.1071,
          outputTokenRatio: 0.1111,
          inputPrice: 1.5,
          outputPrice: 2.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 0.7,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-01-27',
      },
    }
  : {}

export const openrouterLanguageModels: Record<
  OpenrouterLanguageModelName,
  OpenrouterLanguageModel
> = WITH_OPENROUTER_MODELS
  ? {
      // anthropic

      'claude-5.1-fable': {
        description: `Claude Fable 5.1 is Anthropic's most capable model, improving on Fable 5 across long-running agentic coding, knowledge work, and research. It follows instructions precisely over sessions that run unattended for hours and leads on demanding reasoning and long-horizon agentic work.`,

        provider: 'openrouter',

        providerModel: 'anthropic/claude-fable-5.1',

        family: 'fable',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 2.7778,
          inputTokenRatio: 0.7143,
          outputTokenRatio: 2.7778,
          inputPrice: 10.0,
          outputPrice: 50.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'claude-5-opus': {
        description: `Claude Opus 5 is Anthropic's latest Opus model and a step-change improvement over Opus 4.8. It delivers major gains in agentic coding, professional knowledge work, and long-horizon reasoning, with stronger performance per token across effort levels.`,

        provider: 'openrouter',

        providerModel: 'anthropic/claude-opus-5',

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-24',
      },

      'claude-5-sonnet': {
        description: `Claude Sonnet 5 is Anthropic's best Sonnet-class model for the combination of speed and intelligence, reaching near-Opus quality on coding and agentic work. It excels at iterative development, complex codebase navigation, long-horizon agentic tasks, and polished professional workflows like document drafting and data analysis.`,

        provider: 'openrouter',

        providerModel: 'anthropic/claude-sonnet-5',

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.5556,
          inputPrice: 2.0,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-01',
      },

      // openai

      'gpt-5.4': {
        description: `GPT-5.4 is OpenAI's frontier model for complex professional work, offering the highest capability in the GPT-5 series with a 1M+ context window and advanced reasoning.`,

        provider: 'openrouter',

        providerModel: 'openai/gpt-5.4',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.1786,
          outputTokenRatio: 0.8333,
          inputPrice: 2.5,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-05',
      },

      'gpt-5.4-mini': {
        description: `GPT-5.4 mini is OpenAI's strongest mini model for coding, computer use, and subagents, bringing the strengths of GPT-5.4 to a faster, more efficient model designed for high-volume workloads.`,

        provider: 'openrouter',

        providerModel: 'openai/gpt-5.4-mini',

        family: 'gpt-5',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 400_000,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.25,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.25,
          inputPrice: 0.75,
          outputPrice: 4.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-17',
      },

      // google

      'gemini-3.8-flash': {
        description: `Gemini 3.8 Flash is Google's most intelligent Flash model, with significant gains over 3.7 Flash across software engineering, agentic tasks, and multi-step reasoning. It supports low, medium, and high thinking levels to control the mix of quality, cost, and latency.`,

        provider: 'openrouter',

        providerModel: 'google/gemini-3.8-flash',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        // @todo-by 2026-12-15 Google list price doubles on 2027-01-01 ($1.50 in / $7.50 out) - update pricing before then
        pricing: {
          tokenRatio: 0.2083,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.2083,
          inputPrice: 0.75,
          outputPrice: 3.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-02',
      },

      'gemini-2.5-pro': {
        description: `A capable multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'openrouter',

        providerModel: 'google/gemini-2.5-pro',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_048_576,
        maxInputTokens: 1_048_576 - 8_192,
        maxOutputTokens: 8_192,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-10',
      },

      'gemini-2.5-flash': {
        description: `A capable and inexpensive, multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'openrouter',

        providerModel: 'google/gemini-2.5-flash',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.1389,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.1389,
          inputPrice: 0.3,
          outputPrice: 2.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-18',
      },

      // moonshotai

      'kimi-k3': {
        description: `Kimi K3 is MoonshotAI's flagship model for long-horizon coding and end-to-end knowledge work, with a 1M-token context window.`,

        provider: 'openrouter',

        providerModel: 'moonshotai/kimi-k3',

        family: 'kimi',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 131_072,
        maxOutputTokens: 131_072,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3,
          outputPrice: 15,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 1, // @note it accepts only 1

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-16',
      },

      // zai

      'glm-5.3': {
        description: `GLM-5.3 delivers comprehensive advancements in complex software engineering and agent capabilities. It uses the same base model as GLM-5.2, with all improvements driven by post-training.`,

        provider: 'openrouter',

        providerModel: 'z-ai/glm-5.3',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.2444,
          inputTokenRatio: 0.1,
          outputTokenRatio: 0.2444,
          inputPrice: 1.4,
          outputPrice: 4.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-18',
      },

      // deepseek

      'deepseek-v4-pro': {
        description: `Top-tier DeepSeek reasoning and coding for the most demanding production workloads. Built for high-context tasks that benefit from deeper deliberation.`,

        provider: 'openrouter',

        providerModel: 'deepseek/deepseek-v4-pro',

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: Math.floor(1_000_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_000_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.11,
          inputTokenRatio: 0.0471,
          outputTokenRatio: 0.11,
          inputPrice: 0.66,
          outputPrice: 1.98,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-24',
      },

      // alibaba

      'qwen-3.8-max': {
        description: `Qwen 3.8 Max is Alibaba's latest flagship model, building on Qwen 3.7 Max with stronger programming, reasoning, and long-horizon agentic execution over a 1M token context window.`,

        provider: 'openrouter',

        providerModel: 'qwen/qwen3.8-max',

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.3333,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.3333,
          inputPrice: 2.0,
          outputPrice: 6.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-02',
      },

      // xai

      'grok-4.6': {
        description: `Grok 4.6 builds on Grok 4.5 with a particular focus on long-running agents and more ambitious interactive and visual work. It stays with complex tasks across many steps, whether researching a topic, analyzing information, working across a codebase, or turning an idea into a polished application or work artifact.`,

        provider: 'openrouter',

        providerModel: 'x-ai/grok-4.6',

        family: 'grok',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 500_000,
        maxInputTokens: Math.floor(500_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(500_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.3333,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.3333,
          inputPrice: 2.0,
          outputPrice: 6.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-19',
      },

      // perplexity

      'sonar-pro': {
        description: `Premier search offering with search grounding, supporting advanced queries and follow-ups.`,

        provider: 'openrouter',

        providerModel: 'perplexity/sonar-pro',

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 192_000,
        maxOutputTokens: 200_000 - 192_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },
    }
  : {}

export const vertexLanguageModels: Record<
  VertexLanguageModelName,
  VertexLanguageModel
> = WITH_VERTEX_MODELS
  ? {
      'gemini-3.8-flash': {
        description: `Gemini 3.8 Flash is Google's most intelligent Flash model, with significant gains over 3.7 Flash across software engineering, agentic tasks, and multi-step reasoning. It supports low, medium, and high thinking levels to control the mix of quality, cost, and latency.`,

        provider: 'vertex',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        // @todo-by 2026-12-15 Google list price doubles on 2027-01-01 ($1.50 in / $7.50 out) - update pricing before then
        pricing: {
          tokenRatio: 0.2083,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.2083,
          inputPrice: 0.75,
          outputPrice: 3.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-02',
      },

      'gemini-2.5-pro': {
        description: `A capable multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'vertex',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_048_576,
        maxInputTokens: 1_048_576 - 8_192,
        maxOutputTokens: 8_192,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-10',
      },

      'gemini-2.5-flash': {
        description: `A capable and inexpensive, multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'vertex',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.1389,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.1389,
          inputPrice: 0.3,
          outputPrice: 2.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-18',
      },

      'gemini-2.5-flash-lite': {
        description: `A small and cost-efficient multi-modal model, built for at-scale usage with a 1 million token context window.`,

        provider: 'vertex',

        family: 'gemini',

        features: ['chat', 'functions', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_048_576,
        maxInputTokens: 1_048_576 - 65_535,
        maxOutputTokens: 65_535,

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0222,
          inputPrice: 0.1,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-18',
      },
    }
  : {}

export const bedrockLanguageModels: Record<
  BedrockLanguageModelName,
  BedrockLanguageModel
> = WITH_BEDROCK_MODELS
  ? {
      'claude-5.1-fable': {
        description: `Claude Fable 5.1 is Anthropic's most capable model, improving on Fable 5 across long-running agentic coding, knowledge work, and research. It follows instructions precisely over sessions that run unattended for hours and leads on demanding reasoning and long-horizon agentic work.`,

        provider: 'bedrock',

        providerModel: 'us.anthropic.claude-fable-5-1-v1:0',

        family: 'fable',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 2.7778,
          inputTokenRatio: 0.7143,
          outputTokenRatio: 2.7778,
          inputPrice: 10.0,
          outputPrice: 50.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'claude-5-opus': {
        description: `Claude Opus 5 is Anthropic's latest Opus model and a step-change improvement over Opus 4.8. It delivers major gains in agentic coding, professional knowledge work, and long-horizon reasoning, with stronger performance per token across effort levels.`,

        provider: 'bedrock',

        providerModel: 'us.anthropic.claude-opus-5-v1:0',

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-24',
      },

      'claude-5-sonnet': {
        description: `Claude Sonnet 5 is Anthropic's best Sonnet-class model for the combination of speed and intelligence, reaching near-Opus quality on coding and agentic work. It excels at iterative development, complex codebase navigation, long-horizon agentic tasks, and polished professional workflows like document drafting and data analysis.`,

        provider: 'bedrock',

        providerModel: 'us.anthropic.claude-sonnet-5-v1:0',

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.5556,
          inputPrice: 2.0,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-01',
      },

      'claude-4.8-opus': {
        description: `Claude Opus 4.8 is Anthropic's best generally available model for coding, agentic tasks, and enterprise workflows. It improves on Opus 4.7 for complex multi-step coding work, long-horizon agentic tasks, and professional workflows like document drafting, data analysis, and presentations.`,

        provider: 'bedrock',

        providerModel: 'us.anthropic.claude-opus-4-8-v1:0',

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-28',
      },

      'claude-4.5-haiku': {
        description: `Claude Haiku 4.5 is Anthropic's fastest and most efficient model, delivering near-frontier intelligence at a fraction of the cost and latency of larger Claude models. Matching Claude Sonnet 4's performance across reasoning, coding, and computer-use tasks, Haiku 4.5 brings frontier-level capability to real-time and high-volume applications.`,

        provider: 'bedrock',

        providerModel: 'us.anthropic.claude-haiku-4-5-v1:0',

        family: 'haiku',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 200_000,
        maxInputTokens: Math.floor(200_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(200_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.2778,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.2778,
          inputPrice: 1.0,
          outputPrice: 5.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-10-16',
      },
    }
  : {}

export const vercelLanguageModels: Record<
  VercelLanguageModelName,
  VercelLanguageModel
> = WITH_VERCEL_MODELS
  ? {
      // google

      'gemini-3.8-flash': {
        description: `Gemini 3.8 Flash is Google's most intelligent Flash model, with significant gains over 3.7 Flash across software engineering, agentic tasks, and multi-step reasoning. It supports low, medium, and high thinking levels to control the mix of quality, cost, and latency.`,

        provider: 'vercel',

        providerModel: 'google/gemini-3.8-flash',

        providerOptions: {
          gateway: {
            only: ['vertex'],
          },
        },

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        // @todo-by 2026-12-15 Google list price doubles on 2027-01-01 ($1.50 in / $7.50 out) - update pricing before then
        pricing: {
          tokenRatio: 0.2083,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.2083,
          inputPrice: 0.75,
          outputPrice: 3.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-02',
      },

      'gemini-2.5-flash': {
        description: `A capable and inexpensive, multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'vercel',

        providerModel: 'google/gemini-2.5-flash',

        providerOptions: {
          gateway: {
            only: ['vertex'],
          },
        },

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us', // @todo find out
        availableRegions: ['us'], // @todo find out

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.1389,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.1389,
          inputPrice: 0.3,
          outputPrice: 2.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-18',
      },

      'gemini-2.5-flash-lite': {
        description: `A small and cost-efficient multi-modal model, built for at-scale usage with a 1 million token context window.`,

        provider: 'vercel',

        providerModel: 'google/gemini-2.5-flash-lite',

        providerOptions: {
          gateway: {
            only: ['vertex'],
          },
        },

        family: 'gemini',

        features: ['chat', 'functions', 'image'],

        region: 'us', // @todo find out
        availableRegions: ['us'], // @todo find out

        maxTokens: 1_048_576,
        maxInputTokens: 1_048_576 - 65_535,
        maxOutputTokens: 65_535,

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0222,
          inputPrice: 0.1,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-18',
      },

      'gemini-2.5-pro': {
        description: `A capable multi-modal model with great performance across all tasks, with a 1 million token context window, and built for the era of Agents.`,

        provider: 'vercel',

        providerModel: 'google/gemini-2.5-pro',

        providerOptions: {
          gateway: {
            only: ['vertex'],
          },
        },

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us', // @todo find out
        availableRegions: ['us'], // @todo find out

        maxTokens: 1_048_576,
        maxInputTokens: 1_048_576 - 8_192,
        maxOutputTokens: 8_192,

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-04-10',
      },

      // facebook

      'muse-spark-1.2': {
        description: `Muse Spark 1.2 is a coding-optimized model purpose-built for agentic workflows. It improves on code generation, debugging, and codebase understanding, with a 1M-token context window that handles an entire project in one session.`,

        provider: 'vercel',

        providerModel: 'meta/muse-spark-1.2',

        providerOptions: {
          gateway: {
            // @note see the ZDR note on muse-spark-1.1 below - meta is the only
            // provider serving this model and is not ZDR-compliant on the
            // Vercel AI Gateway, so forced ZDR leaves the gateway nowhere to
            // route and the request fails with no_providers_available
            zeroDataRetention: false,
          },
        },

        family: 'muse',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_048_576,
        maxInputTokens: Math.floor(1_048_576 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_048_576 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.2361,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.2361,
          inputPrice: 1.25,
          outputPrice: 4.25,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-11',
      },

      'muse-spark-1.1': {
        description: `Muse Spark 1.1 is strongest at agentic performance, tool use, and computer use. It excels at long-running tasks with a 1M-token context window, can delegate execution to parallel sub-agents, and is trained to use computer interfaces across desktop, mobile, and browser environments.`,

        provider: 'vercel',

        providerModel: 'meta/muse-spark-1.1',

        providerOptions: {
          gateway: {
            // @note meta is not a ZDR-compliant provider on the Vercel AI
            // Gateway and is the only provider serving this model, so we opt it
            // out of the platform's forced-ZDR default. With ZDR on, the gateway
            // has no ZDR-compliant provider to route to and the request fails
            // with no_providers_available. See the 'vercel gateway config' tests
            // in lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'muse',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_048_576,
        maxInputTokens: Math.floor(1_048_576 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_048_576 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.2361,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.2361,
          inputPrice: 1.25,
          outputPrice: 4.25,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-09',
      },

      // anthropic

      'claude-5.1-fable': {
        description: `Claude Fable 5.1 is Anthropic's most capable model, improving on Fable 5 across long-running agentic coding, knowledge work, and research. It follows instructions precisely over sessions that run unattended for hours and leads on demanding reasoning and long-horizon agentic work.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-fable-5.1',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'fable',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 2.7778,
          inputTokenRatio: 0.7143,
          outputTokenRatio: 2.7778,
          inputPrice: 10.0,
          outputPrice: 50.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'claude-5-opus': {
        description: `Claude Opus 5 is Anthropic's latest Opus model and a step-change improvement over Opus 4.8. It delivers major gains in agentic coding, professional knowledge work, and long-horizon reasoning, with stronger performance per token across effort levels.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-5',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-24',
      },

      'claude-5-sonnet': {
        description: `Claude Sonnet 5 is Anthropic's best Sonnet-class model for the combination of speed and intelligence, reaching near-Opus quality on coding and agentic work. It excels at iterative development, complex codebase navigation, long-horizon agentic tasks, and polished professional workflows like document drafting and data analysis.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-sonnet-5',

        providerOptions: {
          gateway: {
            only: ['bedrock'],
          },
        },

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        // @note Sonnet 5 introductory pricing ($2 in / $10 out per million) is
        // in effect through 2026-08-31; the Vercel gateway reports these rates.
        // Sticker price reverts to $3 / $15 afterwards - when the live-catalogue
        // test starts failing on the price diff, bump these back to 3.0 / 15.0
        // (inputTokenRatio 0.2143, outputTokenRatio/tokenRatio 0.8333).
        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.5556,
          inputPrice: 2.0,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-01',
      },

      'claude-4.8-opus': {
        description: `Claude Opus 4.8 is Anthropic's best generally available model for coding, agentic tasks, and enterprise workflows. It improves on Opus 4.7 for complex multi-step coding work, long-horizon agentic tasks, and professional workflows like document drafting, data analysis, and presentations.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-4.8',

        providerOptions: {
          gateway: {
            only: ['bedrock'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-28',
      },

      'claude-4.7-opus': {
        description: `Claude Opus 4.7 is Anthropic's most capable generally available model, built for advanced coding, complex agent workflows, vision tasks, and high-stakes professional work that benefits from sustained reasoning and stronger follow-through.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-4.7',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-16',
      },

      'claude-4.6-sonnet': {
        description: `Sonnet 4.6 is Anthropic's most capable Sonnet-class model yet, with frontier performance across coding, agents, and professional work. It excels at iterative development, complex codebase navigation, end-to-end project management with memory, polished document creation, and confident computer use for web QA and workflow automation.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-sonnet-4.6',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-17',
      },

      'claude-4.6-opus': {
        description: `Claude Opus 4.6 is Anthropic's strongest model for coding and long-running professional tasks, optimized for multi-step agent workflows, large codebases, and sustained reasoning over complex engineering work.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-4.6',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-13',
      },

      'claude-4.5-opus': {
        description: `Claude Opus 4.5 is Anthropic’s frontier reasoning model optimized for complex software engineering, agentic workflows, and long-horizon computer use. It offers strong multimodal capabilities, competitive performance across real-world coding and reasoning benchmarks, and improved robustness to prompt injection.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-4.5',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: Math.floor(200_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(200_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 1.3889,
          inputTokenRatio: 0.3571,
          outputTokenRatio: 1.3889,
          inputPrice: 5.0,
          outputPrice: 25.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-11-25',
      },

      'claude-4.5-sonnet': {
        description: `Claude 4.5 Sonnet: advanced Sonnet tuned for agents, long coding and sustained reasoning.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-sonnet-4.5',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-09-30',
      },

      'claude-4.5-haiku': {
        description: `Claude Haiku 4.5 is Anthropic's fastest and most efficient model, delivering near-frontier intelligence at a fraction of the cost and latency of larger Claude models. Matching Claude Sonnet 4's performance across reasoning, coding, and computer-use tasks, Haiku 4.5 brings frontier-level capability to real-time and high-volume applications.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-haiku-4.5',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'haiku',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 200_000,
        maxInputTokens: Math.floor(200_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(200_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.2778,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.2778,
          inputPrice: 1.0,
          outputPrice: 5.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-10-16',
      },

      'claude-4-opus': {
        description: `Claude Opus 4 is benchmarked as the world’s best coding model, at time of release, bringing sustained performance on complex, long-running tasks and agent workflows.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-opus-4',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'opus',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 200_000 - 8_192,
        maxOutputTokens: 8_192,

        pricing: {
          tokenRatio: 4.1667,
          inputTokenRatio: 1.0714,
          outputTokenRatio: 4.1667,
          inputPrice: 15.0,
          outputPrice: 75.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-06-13',
      },

      'claude-4-sonnet': {
        description: `Claude Sonnet 4 significantly enhances the capabilities of its predecessor, Sonnet 3.7, excelling in both coding and reasoning tasks with improved precision and controllability.`,

        provider: 'vercel',

        providerModel: 'anthropic/claude-sonnet-4',

        providerOptions: {
          gateway: {
            only: ['bedrock', 'vertex'],
          },
        },

        family: 'sonnet',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 8_192,
        maxOutputTokens: 8_192,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnAsLastMessage: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-06-13',
      },

      // openai

      'gpt-5.3-codex': {
        description: `GPT-5.3-Codex is a specialized coding model from OpenAI, optimized for software engineering workflows and long-running autonomous code tasks.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5.3-codex',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.7778,
          inputTokenRatio: 0.125,
          outputTokenRatio: 0.7778,
          inputPrice: 1.75,
          outputPrice: 14.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-24',
      },

      'gpt-5.2-codex': {
        description: `GPT-5.2-Codex is a specialized version of GPT-5.2 optimized for software engineering and coding workflows. It is designed for both interactive development sessions and long, independent execution of complex engineering tasks.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5.2-codex',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.7778,
          inputTokenRatio: 0.125,
          outputTokenRatio: 0.7778,
          inputPrice: 1.75,
          outputPrice: 14.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-01-16',
      },

      'gpt-5.1-codex-max': {
        description: `GPT-5.1-Codex-Max is OpenAI's latest agentic coding model, designed for long-running, high-context software development tasks.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5.1-codex-max',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-12-18',
      },

      'gpt-5.1-codex-mini': {
        description: `GPT-5.1-Codex-Mini is a smaller and faster version of GPT-5.1-Codex.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5.1-codex-mini',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.1111,
          inputTokenRatio: 0.0179,
          outputTokenRatio: 0.1111,
          inputPrice: 0.25,
          outputPrice: 2.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-12-18',
      },

      'gpt-5.1-codex': {
        description: `GPT-5.1-Codex is a specialized version of GPT-5.1 optimized for software engineering and coding workflows. It is designed for both interactive development sessions and long, independent execution of complex engineering tasks.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5.1-codex',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-11-20',
      },

      'gpt-5-codex': {
        description: `GPT-5-Codex is a specialized version of GPT-5 optimized for software engineering and coding workflows. It is designed for both interactive development sessions and long, independent execution of complex engineering tasks.`,

        provider: 'vercel',

        providerModel: 'openai/gpt-5-codex',

        providerOptions: {
          gateway: {
            only: ['openai'],

            // @note openai is not a ZDR-compliant provider on the Vercel AI
            // Gateway, so we opt these models out of the platform's forced-ZDR
            // default. With ZDR on and only openai allowed, the gateway has no
            // ZDR-compliant provider to route to and the request fails with
            // no_providers_available. See the 'vercel gateway config' tests in
            // lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'gpt-5',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 400_000,
        maxOutputTokens: Math.ceil(400_000 * MAX_OUTPUT_TOKENS_RATIO),
        maxInputTokens: Math.floor(400_000 * MAX_INPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.5556,
          inputTokenRatio: 0.0893,
          outputTokenRatio: 0.5556,
          inputPrice: 1.25,
          outputPrice: 10.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-09-25',
      },

      'gemma-4-31b': {
        description: `Gemma 4 31B Instruct is Google DeepMind's multimodal 31B class model with text and image input, text output, configurable reasoning, native function calling, and multilingual support across more than 140 languages.`,

        provider: 'vercel',

        providerModel: 'google/gemma-4-31b-it',

        family: 'gemma',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 262_144,
        maxInputTokens: Math.floor(262_144 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.floor(262_144 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.01,
          outputTokenRatio: 0.0222,
          inputPrice: 0.14,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-04',
      },

      // mistral

      'devstral-2': {
        description: `Devstral 2 is Mistral AI's coding-focused model for agentic software engineering workflows.`,

        provider: 'vercel',

        providerModel: 'mistral/devstral-2',

        family: 'devstral',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 256_000,
        maxInputTokens: 256_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.1111,
          inputTokenRatio: 0.0286,
          outputTokenRatio: 0.1111,
          inputPrice: 0.4,
          outputPrice: 2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-06-14',
      },

      'mistral-large-latest': {
        description: `Top-tier reasoning for high-complexity tasks. The most powerful model of the Mistral AI family.`,

        provider: 'vercel',

        providerModel: 'mistral/mistral-large-3',

        family: 'mistral-large',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 256_000,
        maxInputTokens: 256_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.0833,
          inputTokenRatio: 0.0357,
          outputTokenRatio: 0.0833,
          inputPrice: 0.5,
          outputPrice: 1.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-02-27',
      },

      'mistral-small-latest': {
        description: `Cost-efficient reasoning for low-latency workloads.`,

        provider: 'vercel',

        providerModel: 'mistral/mistral-small',

        family: 'mistral-small',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 32_000,
        maxInputTokens: 28_000,
        maxOutputTokens: 4_000,

        pricing: {
          tokenRatio: 0.0167,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0167,
          inputPrice: 0.1,
          outputPrice: 0.3,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-06-19',
      },

      // deepseek

      'deepseek-v4-pro': {
        description: `Top-tier DeepSeek reasoning and coding for the most demanding production workloads. Built for high-context tasks that benefit from deeper deliberation.`,

        provider: 'vercel',

        providerModel: 'deepseek/deepseek-v4-pro',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: Math.floor(1_000_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_000_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.11,
          inputTokenRatio: 0.0471,
          outputTokenRatio: 0.11,
          inputPrice: 0.66,
          outputPrice: 1.98,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-24',
      },

      'deepseek-v4-flash': {
        description: `Fast, cost-efficient DeepSeek reasoning for latency-sensitive workloads that still need a massive context window and strong tool use.`,

        provider: 'vercel',

        providerModel: 'deepseek/deepseek-v4-flash',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: Math.floor(1_000_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_000_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0144,
          inputTokenRatio: 0.0093,
          outputTokenRatio: 0.0144,
          inputPrice: 0.13,
          outputPrice: 0.26,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-24',
      },

      'deepseek-v3.2': {
        description: `Top-tier reasoning for high-complexity tasks. The most powerful model of the Deepseek AI family.`,

        provider: 'vercel',

        providerModel: 'deepseek/deepseek-v3.2',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 164_000,
        maxInputTokens: Math.floor(164_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(164_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0156,
          inputTokenRatio: 0.01,
          outputTokenRatio: 0.0156,
          inputPrice: 0.14,
          outputPrice: 0.28,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: false,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-01-23',
      },

      // perplexity

      'sonar-reasoning-pro': {
        description: `Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT) and advanced search grounding.`,

        provider: 'vercel',

        providerModel: 'perplexity/sonar-reasoning-pro',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      'sonar-reasoning': {
        description: `Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT).`,

        provider: 'vercel',

        providerModel: 'perplexity/sonar-reasoning-pro',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      'sonar-pro': {
        description: `Premier search offering with search grounding, supporting advanced queries and follow-ups.`,

        provider: 'vercel',

        providerModel: 'perplexity/sonar-pro',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 192_000,
        maxOutputTokens: 200_000 - 192_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      sonar: {
        description: `Lightweight offering with search grounding, quicker and cheaper than Sonar Pro.`,

        provider: 'vercel',

        providerModel: 'perplexity/sonar',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.0556,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.0556,
          inputPrice: 1.0,
          outputPrice: 1.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],
      },

      // zai

      'glm-5.3-flash': {
        description: `GLM-5.3-Flash is Z.AI's native multimodal coding model (320B total, 18B active parameters), built for visual coding and professional workflows spanning code, browser, and graphical interfaces at a fast, low-cost tier.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5.3-flash',

        providerOptions: {
          gateway: {
            // @note glm-5.3-flash is served only by the non-ZDR `zai` provider, so the
            // forced-ZDR default leaves the gateway nowhere to route and the
            // request 400s at runtime. Opt out of forced ZDR (same as glm-4.5-air).
            zeroDataRetention: false,
          },
        },

        family: 'glm',

        features: ['chat', 'functions', 'reasoning', 'image', 'file'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 131_000,
        maxOutputTokens: 131_000,

        pricing: {
          tokenRatio: 0.0278,
          inputTokenRatio: 0.0107,
          outputTokenRatio: 0.0278,
          inputPrice: 0.15,
          outputPrice: 0.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-26',
      },

      'glm-5.3': {
        description: `GLM-5.3 delivers comprehensive advancements in complex software engineering and agent capabilities. It uses the same base model as GLM-5.2, with all improvements driven by post-training.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5.3',

        providerOptions: {
          gateway: {
            // @note glm-5.3 is served only by the non-ZDR `zai` provider, so the
            // forced-ZDR default leaves the gateway nowhere to route and the
            // request 400s at runtime. Opt out of forced ZDR (same as glm-4.5-air).
            zeroDataRetention: false,
          },
        },

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.1222,
          inputTokenRatio: 0.05,
          outputTokenRatio: 0.1222,
          inputPrice: 0.7,
          outputPrice: 2.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-18',
      },

      'glm-5.2': {
        description: `GLM-5.2 delivers powerful coding capabilities, usable 1M-context support, and continued strengths in long-horizon tasks.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5.2',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.1417,
          inputTokenRatio: 0.0571,
          outputTokenRatio: 0.1417,
          inputPrice: 0.8,
          outputPrice: 2.55,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-06-16',
      },

      'glm-5.1': {
        description: `GLM-5.1 delivers a major leap in coding capability, with particularly significant gains in handling long-horizon tasks. Unlike previous models built around minute-level interactions, GLM-5.1 can work independently and continuously on a single task for more than 8 hours, autonomously planning, executing, and improving itself throughout the process, ultimately delivering complete, engineering-grade results.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5.1',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 202_800,
        maxInputTokens: 202_800 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.2444,
          inputTokenRatio: 0.1,
          outputTokenRatio: 0.2444,
          inputPrice: 1.4,
          outputPrice: 4.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-07',
      },

      'glm-5v-turbo': {
        description: `GLM-5V-Turbo is Z.AI's vision-enabled turbo model for design-to-code, visual debugging, and agentic GUI workflows, combining multimodal input with GLM-5 generation reasoning at a faster, lower-cost tier.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5v-turbo',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning', 'image', 'file'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxOutputTokens: 128_000,
        maxInputTokens: 200_000 - 128_000,

        pricing: {
          tokenRatio: 0.2222,
          inputTokenRatio: 0.0857,
          outputTokenRatio: 0.2222,
          inputPrice: 1.2,
          outputPrice: 4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-01',
      },

      'glm-5-turbo': {
        description: `GLM-5-Turbo is Z.AI's speed-optimized GLM-5 variant for high-volume agentic pipelines, preserving selectable thinking modes and long-context coding capabilities at lower latency and cost than full GLM-5.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5-turbo',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 202_800,
        maxInputTokens: 202_800 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.2222,
          inputTokenRatio: 0.0857,
          outputTokenRatio: 0.2222,
          inputPrice: 1.2,
          outputPrice: 4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-15',
      },

      'glm-5': {
        description: `GLM-5 is Z.AI's fifth-generation flagship open-source foundation model with 744B parameters (40B active MoE), engineered for complex systems design and long-horizon agent workflows. It delivers production-grade performance on large-scale programming tasks with advanced agentic planning, deep backend reasoning, and iterative self-correction.`,

        provider: 'vercel',

        providerModel: 'zai/glm-5',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 202_800,
        maxInputTokens: 202_800 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.1778,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.1778,
          inputPrice: 1,
          outputPrice: 3.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-11',
      },

      'glm-4.7-flash': {
        description: `GLM-4.7-Flash is Z.AI's fast, cost-efficient model optimized for coding, agentic workflows, and real-world use on lower hardware budgets. It offers strong performance in coding and multistep reasoning tasks while being more affordable than the flagship GLM-4.7.`,

        provider: 'vercel',

        providerModel: 'zai/glm-4.7-flash',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 72_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0222,
          inputTokenRatio: 0.005,
          outputTokenRatio: 0.0222,
          inputPrice: 0.07,
          outputPrice: 0.4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-01-19',
      },

      'glm-4.7': {
        description: `GLM-4.7 is Z.AI's latest flagship model, featuring upgrades in two key areas: enhanced programming capabilities and more stable multi-step reasoning/execution. It demonstrates significant improvements in executing complex agent tasks while delivering more natural conversational experiences and superior front-end aesthetics.`,

        provider: 'vercel',

        providerModel: 'zai/glm-4.7',

        family: 'glm',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 200_000 - 40_000,
        maxOutputTokens: 40_000,

        pricing: {
          tokenRatio: 0.1222,
          inputTokenRatio: 0.0429,
          outputTokenRatio: 0.1222,
          inputPrice: 0.6,
          outputPrice: 2.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-12-29',
      },

      'glm-4.5-air': {
        description: `GLM-4.5-Air is the lightweight variant of Z.AI's latest flagship model family, purpose-built for agent-centric applications. Like GLM-4.5, it adopts the Mixture-of-Experts (MoE) architecture but with a more compact parameter size. GLM-4.5-Air supports hybrid inference modes, offering a "thinking mode" for advanced reasoning and tool use, and a "non-thinking mode" for real-time interaction.`,

        provider: 'vercel',

        providerModel: 'zai/glm-4.5-air',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'glm',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 128_000,
        maxInputTokens: 128_000 - 16_384,
        maxOutputTokens: 16_384,

        pricing: {
          tokenRatio: 0.0611,
          inputTokenRatio: 0.0143,
          outputTokenRatio: 0.0611,
          inputPrice: 0.2,
          outputPrice: 1.1,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-05',
      },

      // minimax

      'minimax-m3': {
        description: `MiniMax M3 combines a 1M-token context window, native multimodal input, and strong coding and agentic performance for long-horizon software engineering, terminal tool use, and web browsing workflows.`,

        provider: 'vercel',

        providerModel: 'minimax/minimax-m3',

        family: 'minimax',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0667,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.0667,
          inputPrice: 0.3,
          outputPrice: 1.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-31',
      },

      'minimax-m2.7': {
        description: `MiniMax M2.7 delivers strong real-world software engineering performance across end-to-end project delivery, log analysis, bug troubleshooting, code security, and machine learning workflows.`,

        provider: 'vercel',

        providerModel: 'minimax/minimax-m2.7',

        family: 'minimax',

        features: ['chat', 'functions', 'reasoning', 'image'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 204_800,
        maxInputTokens: 204_800 - 131_000,
        maxOutputTokens: 131_000,

        pricing: {
          tokenRatio: 0.0667,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.0667,
          inputPrice: 0.3,
          outputPrice: 1.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-18',
      },

      'minimax-m2.5': {
        description: `MiniMax M2.5 is MiniMax's productivity-focused flagship model optimized for coding, office automation, and multi-step agent workflows with strong benchmark performance and high token efficiency.`,

        provider: 'vercel',

        providerModel: 'minimax/minimax-m2.5',

        family: 'minimax',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 204_800,
        maxInputTokens: 204_800 - 51_200,
        maxOutputTokens: 51_200,

        pricing: {
          tokenRatio: 0.0667,
          inputTokenRatio: 0.0214,
          outputTokenRatio: 0.0667,
          inputPrice: 0.3,
          outputPrice: 1.2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-12',
      },

      // alibaba

      'qwen-3.8-flash': {
        description: `Qwen 3.8 Flash is Alibaba's fast, cost-efficient multimodal model for coding, agentic workflows, visual understanding, and long-context tasks over a 991K token context window.`,

        provider: 'vercel',

        providerModel: 'alibaba/qwen3.8-flash',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 991_000,
        maxInputTokens: 991_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.0261,
          inputTokenRatio: 0.0114,
          outputTokenRatio: 0.0261,
          inputPrice: 0.16,
          outputPrice: 0.47,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-26',
      },

      'qwen-3.8-max': {
        description: `Qwen 3.8 Max is Alibaba's latest flagship model, building on Qwen 3.7 Max with stronger programming, reasoning, and long-horizon agentic execution over a 1M token context window.`,

        provider: 'vercel',

        providerModel: 'alibaba/qwen3.8-max',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 128_000,
        maxOutputTokens: 128_000,

        pricing: {
          tokenRatio: 0.3333,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.3333,
          inputPrice: 2.0,
          outputPrice: 6.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-02',
      },

      'qwen-3.7-max': {
        description: `Qwen 3.7 Max is Alibaba's next-generation flagship model for the agent-centric era, with strong programming, productivity, long-term autonomous execution, and broad agent-level capabilities.`,

        provider: 'vercel',

        providerModel: 'alibaba/qwen3.7-max',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 991_000,
        maxInputTokens: 991_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.4167,
          inputTokenRatio: 0.1786,
          outputTokenRatio: 0.4167,
          inputPrice: 2.5,
          outputPrice: 7.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-21',
      },

      'qwen-3.6-max': {
        description: `Compared with the previously released Qwen3-Max and Qwen3.6-Plus, this model features enhanced vibe coding abilities, more efficient coding agent execution, and significantly improved front-end development skills. Additionally, its long-tail knowledge retention has been further upgraded.`,

        provider: 'vercel',

        providerModel: 'alibaba/qwen-3.6-max-preview',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 240_000,
        maxInputTokens: 240_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.4333,
          inputTokenRatio: 0.0929,
          outputTokenRatio: 0.4333,
          inputPrice: 1.3,
          outputPrice: 7.8,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-20',
      },

      'qwen-3.6-plus': {
        description: `Qwen 3.6 Plus is Alibaba's Plus-tier Qwen 3.6 model, building on Qwen3.5-Plus with stronger reasoning, instruction following, and agentic capabilities for long-context workflows.`,

        provider: 'vercel',

        providerModel: 'alibaba/qwen3.6-plus',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'qwen',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.1667,
          inputTokenRatio: 0.0357,
          outputTokenRatio: 0.1667,
          inputPrice: 0.5,
          outputPrice: 3.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-02',
      },

      // xiaomi

      'mimo-v2.5-pro': {
        description: `MiMo V2.5 Pro is Xiaomi's Pro-tier MiMo v2.5 Mixture-of-Experts reasoning model for agentic workflows, software engineering, and long-horizon tasks with a 1.05M token context window.`,

        provider: 'vercel',

        providerModel: 'xiaomi/mimo-v2.5-pro',

        family: 'mimo',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_050_000,
        maxInputTokens: 1_050_000 - 131_000,
        maxOutputTokens: 131_000,

        pricing: {
          tokenRatio: 0.0483,
          inputTokenRatio: 0.0311,
          outputTokenRatio: 0.0483,
          inputPrice: 0.435,
          outputPrice: 0.87,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-22',
      },

      'mimo-v2.5': {
        description: `MiMo M2.5 is Xiaomi's native full-modal MiMo v2.5 model, supporting text, image, video, and audio understanding with strong agentic capabilities and a 1.05M token context window.`,

        provider: 'vercel',

        providerModel: 'xiaomi/mimo-v2.5',

        family: 'mimo',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_050_000,
        maxInputTokens: 1_050_000 - 131_000,
        maxOutputTokens: 131_000,

        pricing: {
          tokenRatio: 0.0156,
          inputTokenRatio: 0.01,
          outputTokenRatio: 0.0156,
          inputPrice: 0.14,
          outputPrice: 0.28,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-13',
      },

      // moonshotai

      'kimi-k3': {
        description: `Kimi K3 is MoonshotAI's flagship model for long-horizon coding and end-to-end knowledge work, with a 1M-token context window.`,

        provider: 'vercel',

        providerModel: 'moonshotai/kimi-k3',

        family: 'kimi',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 131_072,
        maxOutputTokens: 131_072,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3,
          outputPrice: 15,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 1, // @note it accepts only 1

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-16',
      },

      'kimi-k2.7-code': {
        description: `Kimi K2.7 Code is MoonshotAI's coding-focused Kimi model for software engineering and agentic coding workflows.`,

        provider: 'vercel',

        providerModel: 'moonshotai/kimi-k2.7-code',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'kimi',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 256_000,
        maxInputTokens: 256_000 - 32_768,
        maxOutputTokens: 32_768,

        pricing: {
          tokenRatio: 0.2222,
          inputTokenRatio: 0.0679,
          outputTokenRatio: 0.2222,
          inputPrice: 0.95,
          outputPrice: 4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 1, // @note it accepts only 1

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-06-14',
      },

      'kimi-k2.6': {
        description: `Kimi K2.6 demonstrates particularly strong performance in long-horizon coding tasks and produces professional-grade design with code and vision.`,

        provider: 'vercel',

        providerModel: 'moonshotai/kimi-k2.6',

        providerOptions: {
          gateway: {
            zeroDataRetention: false,
          },
        },

        family: 'kimi',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 262_000,
        maxInputTokens: 262_000 - 65_500,
        maxOutputTokens: 65_500,

        pricing: {
          tokenRatio: 0.2222,
          inputTokenRatio: 0.0679,
          outputTokenRatio: 0.2222,
          inputPrice: 0.95,
          outputPrice: 4,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: 1, // @note it accepts only 1

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-20',
      },

      'kimi-k2.5': {
        description: `Kimi K2.5 is MoonshotAI's flagship multimodal model with 1 trillion parameters (32B activated), 256K context, and strong performance on coding, reasoning, and agentic workflows.`,

        provider: 'vercel',

        providerModel: 'moonshotai/kimi-k2.5',

        family: 'kimi',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 262_114,
        maxInputTokens: 262_114 - 65_535,
        maxOutputTokens: 65_535,

        pricing: {
          tokenRatio: 0.1667,
          inputTokenRatio: 0.0429,
          outputTokenRatio: 0.1667,
          inputPrice: 0.6,
          outputPrice: 3,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-01-31',
      },

      // xai

      'grok-4.6': {
        description: `Grok 4.6 builds on Grok 4.5 with a particular focus on long-running agents and more ambitious interactive and visual work. It stays with complex tasks across many steps, whether researching a topic, analyzing information, working across a codebase, or turning an idea into a polished application or work artifact.`,

        provider: 'vercel',

        providerModel: 'spacexai/grok-4.6',

        providerOptions: {
          gateway: {
            // @note xai is not a ZDR-compliant provider on the Vercel AI
            // Gateway and is the only provider serving this model, so we opt it
            // out of the platform's forced-ZDR default. With ZDR on, the gateway
            // has no ZDR-compliant provider to route to and the request fails
            // with no_providers_available. See the 'vercel gateway config' tests
            // in lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'grok',

        // @note unlike grok-4.5, the gateway lists no pdf input modality for
        // grok-4.6, so the 'file' feature is deliberately absent.
        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 500_000,
        maxInputTokens: Math.floor(500_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(500_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.3333,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.3333,
          inputPrice: 2.0,
          outputPrice: 6.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-19',
      },

      'grok-4.5': {
        description: `Grok 4.5 is SpaceXAI's smartest model, with frontier performance across coding, knowledge work, and STEM.`,

        provider: 'vercel',

        providerModel: 'spacexai/grok-4.5',

        providerOptions: {
          gateway: {
            // @note xai is not a ZDR-compliant provider on the Vercel AI
            // Gateway and is the only provider serving this model, so we opt it
            // out of the platform's forced-ZDR default. With ZDR on, the gateway
            // has no ZDR-compliant provider to route to and the request fails
            // with no_providers_available. See the 'vercel gateway config' tests
            // in lib/model.provider.vercel.utest.js
            zeroDataRetention: false,
          },
        },

        family: 'grok',

        features: ['chat', 'functions', 'image', 'file', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 500_000,
        maxInputTokens: Math.floor(500_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(500_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.3333,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.3333,
          inputPrice: 2.0,
          outputPrice: 6.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-08',
      },
    }
  : {}

// @note the gemini-3.x family lives here rather than on the Vercel gateway:
// Gemini-3 requires the per-tool-call `thought_signature` to be echoed back
// on the follow-up request, and of the two gateways only Cloudflare's
// OpenAI-compat endpoint round-trips that field (Vercel's strips it, which
// breaks every tool round-trip). See the capture/replay in
// model.provider.openai.conv.
export const cloudflareLanguageModels: Record<
  CloudflareLanguageModelName,
  CloudflareLanguageModel
> = WITH_CLOUDFLARE_MODELS
  ? {
      'gemini-3.8-flash': {
        description: `Gemini 3.8 Flash is Google's most intelligent Flash model, with significant gains over 3.7 Flash across software engineering, agentic tasks, and multi-step reasoning. It supports low, medium, and high thinking levels to control the mix of quality, cost, and latency.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3.8-flash',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        // @todo-by 2026-12-15 Google list price doubles on 2027-01-01 ($1.50 in / $7.50 out) - update pricing before then
        pricing: {
          tokenRatio: 0.2083,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.2083,
          inputPrice: 0.75,
          outputPrice: 3.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-02',
      },

      'gemini-3.7-flash': {
        description: `Gemini 3.7 Flash is the next iteration in the Gemini 3 model family, featuring algorithmic improvements to its core reasoning foundation. It supports customizable thinking configurations to control the mix of quality, cost, and latency.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3.7-flash',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.2083,
          inputTokenRatio: 0.0536,
          outputTokenRatio: 0.2083,
          inputPrice: 0.75,
          outputPrice: 3.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-08-13',
      },
      'gemini-3.5-flash': {
        description: `Gemini 3.5 Flash is Google's latest model, highly optimized for coding proficiency and parallel agentic execution loops. It defaults to medium thinking effort for faster and more cost-efficient responses.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3.5-flash',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.5,
          inputTokenRatio: 0.1071,
          outputTokenRatio: 0.5,
          inputPrice: 1.5,
          outputPrice: 9.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-05-19',
      },
      'gemini-3.6-flash': {
        description: `Gemini 3.6 Flash delivers higher quality across coding, agentic workflows, and web development with reduced token consumption and fewer model calls compared to previous model iterations.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3.6-flash',

        family: 'gemini',

        features: ['chat', 'file', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.4167,
          inputTokenRatio: 0.1071,
          outputTokenRatio: 0.4167,
          inputPrice: 1.5,
          outputPrice: 7.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-07-21',
      },
      'gemini-3-flash': {
        description: `Gemini 3 Flash Preview is a high speed, high value thinking model designed for agentic workflows, multi turn chat, and coding assistance.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3-flash',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.1667,
          inputTokenRatio: 0.0357,
          outputTokenRatio: 0.1667,
          inputPrice: 0.5,
          outputPrice: 3.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-12-18',
      },
      'gemini-3.1-flash-lite': {
        description: `Gemini 3.1 Flash Lite Preview is Google's high-efficiency model optimized for high-volume use cases, improving on Gemini 2.5 Flash Lite across audio input, retrieval, translation, extraction, and code while supporting configurable reasoning levels.`,

        provider: 'cloudflare',

        providerModel: 'google/gemini-3.1-flash-lite',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 65_000,
        maxOutputTokens: 65_000,

        pricing: {
          tokenRatio: 0.0833,
          inputTokenRatio: 0.0179,
          outputTokenRatio: 0.0833,
          inputPrice: 0.25,
          outputPrice: 1.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        requiresUserTurnBeforeToolCall: true,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-03-03',
      },
      'gemini-3.1-pro': {
        description: `Gemini 3.1 Pro Preview is Google’s next-generation frontier model for high-precision multimodal reasoning across text, image, video, audio, and code with a long-context window.`,

        provider: 'cloudflare',

        // @note Cloudflare lists this model without the `-preview`
        // suffix used by the Vercel gateway
        providerModel: 'google/gemini-3.1-pro',

        family: 'gemini',

        features: ['chat', 'functions', 'image', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: 1_000_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.6667,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.6667,
          inputPrice: 2.0,
          outputPrice: 12.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-02-19',
      },
    }
  : {}

export const perplexityLanguageModels: Record<
  PerplexityLanguageModelName,
  PerplexityLanguageModel
> = WITH_PERPLEXITY_MODELS
  ? {
      'sonar-reasoning-pro': {
        description: `Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT) and advanced search grounding.`,

        provider: 'perplexity',

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      'sonar-reasoning': {
        description: `Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT).`,

        provider: 'perplexity',

        providerModel: 'sonar-reasoning-pro',

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.4444,
          inputTokenRatio: 0.1429,
          outputTokenRatio: 0.4444,
          inputPrice: 2.0,
          outputPrice: 8.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      'sonar-pro': {
        description: `Premier search offering with search grounding, supporting advanced queries and follow-ups.`,

        provider: 'perplexity',

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 200_000,
        maxInputTokens: 192_000,
        maxOutputTokens: 200_000 - 192_000,

        pricing: {
          tokenRatio: 0.8333,
          inputTokenRatio: 0.2143,
          outputTokenRatio: 0.8333,
          inputPrice: 3.0,
          outputPrice: 15.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-03-07',
      },

      sonar: {
        description: `Lightweight offering with search grounding, quicker and cheaper than Sonar Pro.`,

        provider: 'perplexity',

        family: 'sonar',

        features: ['chat'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 127_000,
        maxInputTokens: 119_000,
        maxOutputTokens: 8_000,

        pricing: {
          tokenRatio: 0.0556,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.0556,
          inputPrice: 1.0,
          outputPrice: 1.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],
      },
    }
  : {}

export const mistralLanguageModels: Record<
  MistralLanguageModelName,
  MistralLanguageModel
> = WITH_MISTRAL_MODELS
  ? {
      'devstral-2': {
        description: `Devstral 2 is Mistral AI's coding-focused model for agentic software engineering workflows.`,

        provider: 'mistral',

        family: 'devstral',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 256_000,
        maxInputTokens: 256_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.1111,
          inputTokenRatio: 0.0286,
          outputTokenRatio: 0.1111,
          inputPrice: 0.4,
          outputPrice: 2,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-06-14',
      },

      'mistral-large-latest': {
        description: `Top-tier reasoning for high-complexity tasks. The most powerful model of the Mistral AI family.`,

        provider: 'mistral',

        family: 'mistral-large',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 256_000,
        maxInputTokens: 256_000 - 64_000,
        maxOutputTokens: 64_000,

        pricing: {
          tokenRatio: 0.0833,
          inputTokenRatio: 0.0357,
          outputTokenRatio: 0.0833,
          inputPrice: 0.5,
          outputPrice: 1.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-02-27',
      },

      'mistral-small-latest': {
        description: `Cost-efficient reasoning for low-latency workloads.`,

        provider: 'mistral',

        family: 'mistral-small',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 32_000,
        maxInputTokens: 28_000,
        maxOutputTokens: 4_000,

        pricing: {
          tokenRatio: 0.0167,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0167,
          inputPrice: 0.1,
          outputPrice: 0.3,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2024-06-19',
      },
    }
  : {}

export const groqLanguageModels: Record<
  GroqLanguageModelName,
  GroqLanguageModel
> = WITH_GROQ_MODELS
  ? {
      'gpt-oss-120b': {
        description: `GPT-OSS 120B is OpenAI's larger open-weights Mixture-of-Experts model, served on Groq's LPU hardware for high-throughput reasoning, coding, and agentic workloads.`,

        provider: 'groq',

        providerModel: 'openai/gpt-oss-120b',

        family: 'gpt-oss',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 131_072,
        maxInputTokens: 131_072 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.0417,
          inputTokenRatio: 0.0107,
          outputTokenRatio: 0.0417,
          inputPrice: 0.15,
          outputPrice: 0.75,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'gpt-oss-20b': {
        description: `GPT-OSS 20B is OpenAI's smaller open-weights model, served on Groq's LPU hardware for low-latency, cost-efficient reasoning and tool use.`,

        provider: 'groq',

        providerModel: 'openai/gpt-oss-20b',

        family: 'gpt-oss',

        features: ['chat', 'functions', 'reasoning'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 131_072,
        maxInputTokens: 131_072 - 65_536,
        maxOutputTokens: 65_536,

        pricing: {
          tokenRatio: 0.0278,
          inputTokenRatio: 0.0071,
          outputTokenRatio: 0.0278,
          inputPrice: 0.1,
          outputPrice: 0.5,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'kimi-k2': {
        description: `Kimi K2 is MoonshotAI's open-weights trillion-parameter Mixture-of-Experts model with strong coding and agentic tool-use capabilities, served on Groq's LPU hardware.`,

        provider: 'groq',

        providerModel: 'moonshotai/kimi-k2-instruct-0905',

        family: 'kimi',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 262_144,
        maxInputTokens: 262_144 - 16_384,
        maxOutputTokens: 16_384,

        pricing: {
          tokenRatio: 0.1667,
          inputTokenRatio: 0.0714,
          outputTokenRatio: 0.1667,
          inputPrice: 1.0,
          outputPrice: 3.0,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },

      'llama-3.3-70b': {
        description: `Llama 3.3 70B is Meta's open-weights workhorse model for general chat and tool use, served on Groq's LPU hardware for very low latency.`,

        provider: 'groq',

        providerModel: 'llama-3.3-70b-versatile',

        family: 'llama',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 131_072,
        maxInputTokens: 131_072 - 32_768,
        maxOutputTokens: 32_768,

        pricing: {
          tokenRatio: 0.0439,
          inputTokenRatio: 0.0421,
          outputTokenRatio: 0.0439,
          inputPrice: 0.59,
          outputPrice: 0.79,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-09-01',
      },
    }
  : {}

export const deepseekLanguageModels: Record<
  DeepseekLanguageModelName,
  DeepseekLanguageModel
> = WITH_DEEPSEEK_MODELS
  ? {
      'deepseek-v4-pro': {
        description: `Top-tier DeepSeek reasoning and coding for the most demanding production workloads. Built for high-context tasks that benefit from deeper deliberation.`,

        provider: 'deepseek',

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: Math.floor(1_000_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_000_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.11,
          inputTokenRatio: 0.0471,
          outputTokenRatio: 0.11,
          inputPrice: 0.66,
          outputPrice: 1.98,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-24',
      },

      'deepseek-v4-flash': {
        description: `Fast, cost-efficient DeepSeek reasoning for latency-sensitive workloads that still need a massive context window and strong tool use.`,

        provider: 'deepseek',

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        featured: true,

        maxTokens: 1_000_000,
        maxInputTokens: Math.floor(1_000_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(1_000_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0144,
          inputTokenRatio: 0.0093,
          outputTokenRatio: 0.0144,
          inputPrice: 0.13,
          outputPrice: 0.26,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: true,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2026-04-24',
      },

      'deepseek-v3.2': {
        description: `Top-tier reasoning for high-complexity tasks. The most powerful model of the Deepseek AI family.`,

        provider: 'deepseek',

        family: 'deepseek',

        features: ['chat', 'functions'],

        region: 'us',
        availableRegions: ['us'],

        maxTokens: 164_000,
        maxInputTokens: Math.floor(164_000 * MAX_INPUT_TOKENS_RATIO),
        maxOutputTokens: Math.ceil(164_000 * MAX_OUTPUT_TOKENS_RATIO),

        pricing: {
          tokenRatio: 0.0156,
          inputTokenRatio: 0.01,
          outputTokenRatio: 0.0156,
          inputPrice: 0.14,
          outputPrice: 0.28,
        },

        interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

        thresholdStrategy: 'truncate',

        visible: false,
        deprecated: false,

        temperature: DEFAULT_TEMPERATURE,

        frequencyPenalty: 0,
        presencePenalty: 0,

        tags: [],

        addedDate: '2025-01-23',
      },
    }
  : {}

export const chatbotkitLanguageModels: Record<
  ChatBotKitLanguageModelName,
  ChatBotKitLanguageModel
> = {
  // base

  base: {
    description: `The base language model which is used for token counting.`,

    provider: 'chatbotkit',

    family: 'chatbotkit',

    features: [],

    region: 'us',
    availableRegions: ['us'],

    maxTokens: 2,
    maxInputTokens: 1,
    maxOutputTokens: 1,

    pricing: {
      tokenRatio: 1,
      inputTokenRatio: 1,
      outputTokenRatio: 1,
      inputPrice: 14.0,
      outputPrice: 18.0,
    },

    interactionMaxMessages: 2,

    thresholdStrategy: 'truncate',

    visible: false,
    deprecated: false,

    temperature: 0.0,

    frequencyPenalty: 0,
    presencePenalty: 0,

    tags: [],
  },

  // custom

  custom: {
    description: `Any custom model created by the user.`,

    provider: 'chatbotkit',

    family: 'chatbotkit',

    features: ['chat', 'functions', 'reasoning', 'image', 'file'], // @note added all features to allow customizations

    region: 'us',
    availableRegions: ['us'],

    maxTokens: 128_000,
    maxInputTokens: Math.floor(128_000 * MAX_INPUT_TOKENS_RATIO),
    maxOutputTokens: Math.ceil(128_000 * MAX_OUTPUT_TOKENS_RATIO),

    pricing: {
      tokenRatio: 0.0028,
      inputTokenRatio: 0.0036,
      outputTokenRatio: 0.0028,
      inputPrice: 0.05,
      outputPrice: 0.05,
    },

    interactionMaxMessages: DEFAULT_INTERACTION_MAX_MESSAGES,

    thresholdStrategy: 'truncate',

    visible: true,
    deprecated: false,

    temperature: 0.0,

    frequencyPenalty: 0,
    presencePenalty: 0,

    tags: [],
  },

  ...(WITH_VERCEL_MODELS
    ? {
        // text-qaa-web (requires vercel models for sonar proxy target)

        'text-qaa-web-001': {
          description: `Fast and efficient question and answer model with web search grounding.`,

          provider: 'chatbotkit',

          family: 'sonar',

          features: ['chat'],

          region: 'us',
          availableRegions: ['us'],

          maxTokens: 127_000,
          maxInputTokens: 119_000,
          maxOutputTokens: 8_000,

          pricing: {
            tokenRatio: 0.0556,
            inputTokenRatio: 0.0714,
            outputTokenRatio: 0.0556,
            inputPrice: 1.0,
            outputPrice: 1.0,
          },

          interactionMaxMessages: 4,

          thresholdStrategy: 'truncate',

          visible: true,
          deprecated: false,

          temperature: 0.2,

          frequencyPenalty: 0,
          presencePenalty: 0,

          proxyToModel: 'sonar',

          tags: [],

          addedDate: '2025-03-07',
        },
      }
    : {}),

  ...(WITH_OPENAI_MODELS
    ? {
        // text-qaa

        ...{
          'text-qaa-005': {
            description: `This model belongs to the GPT-4o mini family of ChatBotKit models. It is designed for question and answer applications. The model has a token limit of 128000 and provides a balance between cost and quality. It is a custom model based on the gpt model architecture.`,

            provider: 'chatbotkit',

            family: 'gpt-4o',

            features: ['chat', 'functions', 'image'],

            region: 'us',
            availableRegions: ['us'],

            maxTokens: 128 * ONE_T,
            maxInputTokens: (128 - 4) * ONE_T,
            maxOutputTokens: 4 * ONE_T,

            pricing: {
              tokenRatio: 0.8333,
              inputTokenRatio: 0.3571,
              outputTokenRatio: 0.8333,
              inputPrice: 5.0,
              outputPrice: 15.0,
            },

            interactionMaxMessages: 4,

            thresholdStrategy: 'truncate',

            forceFunction: 'query', // TODO: use a const to avoid typos or different names

            visible: true,
            deprecated: false,

            temperature: 0.2,

            frequencyPenalty: 0,
            presencePenalty: 0,

            proxyToModel: 'gpt-4o-mini',

            tags: [],

            addedDate: '2024-11-05',
          },

          'text-qaa-004': {
            description: `This model belongs to the GPT-4o family of ChatBotKit models. It is designed for question and answer applications. The model has a token limit of 128000 and provides a balance between cost and quality. It is a custom model based on the gpt model architecture.`,

            provider: 'chatbotkit',

            family: 'gpt-4o',

            features: ['chat', 'functions', 'image'],

            region: 'us',
            availableRegions: ['us'],

            maxTokens: 128 * ONE_T,
            maxInputTokens: (128 - 4) * ONE_T,
            maxOutputTokens: 4 * ONE_T,

            pricing: {
              tokenRatio: 0.8333,
              inputTokenRatio: 0.3571,
              outputTokenRatio: 0.8333,
              inputPrice: 5.0,
              outputPrice: 15.0,
            },

            interactionMaxMessages: 4,

            thresholdStrategy: 'truncate',

            forceFunction: 'query', // TODO: use a const to avoid typos or different names

            visible: true,
            deprecated: false,

            temperature: 0.2,

            frequencyPenalty: 0,
            presencePenalty: 0,

            proxyToModel: 'gpt-4o',

            tags: [],

            addedDate: '2024-09-14',
          },

          'text-qaa-003': {
            description: `This model belongs to the GPT-4 Turbo family of ChatBotKit models. It is designed for question and answer applications. The model has a token limit of 128000 and provides a balance between cost and quality. It is a custom model based on the gpt model architecture.`,

            provider: 'chatbotkit',

            family: 'gpt-4-turbo',

            features: ['chat', 'functions', 'image'],

            region: 'us',
            availableRegions: ['us'],

            maxTokens: 128 * ONE_T,
            maxInputTokens: (128 - 4) * ONE_T,
            maxOutputTokens: 4 * ONE_T,

            pricing: {
              tokenRatio: 1.6667,
              inputTokenRatio: 0.7143,
              outputTokenRatio: 1.6667,
              inputPrice: 10.0,
              outputPrice: 30.0,
            },

            interactionMaxMessages: 4,

            thresholdStrategy: 'truncate',

            forceFunction: 'query', // TODO: use a const to avoid typos or different names

            visible: true,
            deprecated: false,

            temperature: 0.2,

            frequencyPenalty: 0,
            presencePenalty: 0,

            proxyToModel: 'gpt-4-turbo',

            tags: [],

            addedDate: '2024-02-14',
          },

          'text-qaa-002': {
            description: `This model belongs to the GPT-4 family of ChatBotKit models. It is designed for question and answer applications. The model has a token limit of 8 * ONE_K and provides a balance between cost and quality. It is a custom model based on the gpt model architecture.`,

            provider: 'chatbotkit',

            family: 'gpt-4',

            features: ['chat', 'functions'],

            region: 'us',
            availableRegions: ['us'],

            maxTokens: 8 * ONE_K,
            maxInputTokens: Math.floor(8 * ONE_K * MAX_INPUT_TOKENS_RATIO),
            maxOutputTokens: Math.ceil(8 * ONE_K * MAX_OUTPUT_TOKENS_RATIO),

            pricing: {
              tokenRatio: 3.3333,
              inputTokenRatio: 2.1429,
              outputTokenRatio: 3.3333,
              inputPrice: 30.0,
              outputPrice: 60.0,
            },

            interactionMaxMessages: 4,

            thresholdStrategy: 'truncate',

            forceFunction: 'query', // TODO: use a const to avoid typos or different names

            visible: true,
            deprecated: false,

            temperature: 0.2,

            frequencyPenalty: 0,
            presencePenalty: 0,

            proxyToModel: 'gpt-4',

            tags: [],

            addedDate: '2024-02-14',
          },

          'text-qaa-001': {
            description: `This model belongs to the GPT 3.5 Turbo family of ChatBotKit models. It is designed for question and answer applications. The model has a token limit of 4000 and provides a balance between cost and quality. It is a custom model based on the gpt model architecture.`,

            provider: 'chatbotkit',

            family: 'gpt-3.5-turbo',

            features: ['chat', 'functions'],

            region: 'us',
            availableRegions: ['us'],

            maxTokens: 4 * ONE_K,
            maxInputTokens: Math.floor(4 * ONE_K * MAX_INPUT_TOKENS_RATIO),
            maxOutputTokens: Math.ceil(4 * ONE_K * MAX_OUTPUT_TOKENS_RATIO),

            pricing: {
              tokenRatio: 0.0833,
              inputTokenRatio: 0.0357,
              outputTokenRatio: 0.0833,
              inputPrice: 0.5,
              outputPrice: 1.5,
            },

            interactionMaxMessages: 4,

            thresholdStrategy: 'truncate',

            forceFunction: 'query', // TODO: use a const to avoid typos or different names

            visible: true,
            deprecated: false,

            temperature: 0.2,

            frequencyPenalty: 0,
            presencePenalty: 0,

            proxyToModel: 'gpt-3.5-turbo',

            tags: [],

            addedDate: '2024-01-27',
          },
        },
      }
    : {}),
}

/**
 * Deprecated Language Models
 *
 * These models are deprecated aliases preserved for backward compatibility.
 * They are dynamically generated from a mapping dictionary - each entry copies
 * all parameters from its proxy target but overrides the provider to 'none',
 * sets a generic description, and marks the model as deprecated and hidden.
 */

const DEPRECATED_LANGUAGE_MODEL_DESCRIPTION =
  'Deprecated model. This alias is preserved for backward compatibility.'

/**
 */
const deprecatedLanguageModelProxyMapping: Record<string, string> = {
  // OpenAI
  'gpt-5.6': 'gpt-5.6-sol',
  'gpt-5.5-2026-04-23': 'gpt-5.5',
  'gpt-5.4-mini-2026-03-17': 'gpt-5.4-mini',
  'gpt-5.4-nano-2026-03-17': 'gpt-5.4-nano',
  'gpt-5.4-pro-2026-03-05': 'gpt-5.4-pro',
  'gpt-5.2-2025-12-11': 'gpt-5.2',
  'gpt-5.1-2025-11-13': 'gpt-5.1',
  'gpt-5-2025-08-07': 'gpt-5',
  'gpt-5-mini-2025-08-07': 'gpt-5-mini',
  'gpt-5-nano-2025-08-07': 'gpt-5-nano',
  'o4-mini-2025-04-16': 'o4-mini',
  'o3-2025-04-16': 'o3',
  'o3-deep-research': 'o3',
  'gpt-4.1-nano-2025-04-14': 'gpt-4.1-nano',
  'gpt-4.1-mini-2025-04-14': 'gpt-4.1-mini',
  'gpt-4.1-2025-04-14': 'gpt-4.1',
  'gpt-4.5': 'gpt-5.4',
  'o3-mini-2025-01-31': 'o3-mini',
  'o3-mini-next': 'o3-mini',
  'o3-mini-classic': 'o3-mini',
  'o1-2024-12-17': 'o1',
  'o1-next': 'o1',
  'o1-classic': 'o1',
  'gpt-4o-2024-11-20': 'gpt-4o',
  'gpt-4o-2024-08-06': 'gpt-4o',
  'gpt-4o-2024-05-13': 'gpt-4o',
  'gpt-4o-next': 'gpt-4o',
  'gpt-4o-classic': 'gpt-4o',
  'o1-preview-2024-09-12': 'o1-2024-12-17',
  'o1-mini-2024-09-12': 'o4-mini',
  'o1-mini-next': 'o1-mini-2024-09-12',
  'o1-mini-classic': 'o1-mini-2024-09-12',
  'o1-mini': 'o1-mini-2024-09-12',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',
  'gpt-4o-mini-next': 'gpt-4o-mini',
  'gpt-4o-mini-classic': 'gpt-4o-mini',
  'gpt-4-turbo-2024-04-09': 'gpt-4-turbo',
  'gpt-4-0125-preview': 'gpt-4-turbo',
  'gpt-4-1106-preview': 'gpt-4-turbo',
  'gpt-4-turbo-next': 'gpt-4-turbo',
  'gpt-4-turbo-classic': 'gpt-4-turbo',
  'gpt-3.5-turbo-0125': 'gpt-3.5-turbo',
  'gpt-3.5-turbo-1106': 'gpt-3.5-turbo',
  'gpt-3.5-turbo-next': 'gpt-3.5-turbo',
  'gpt-3.5-turbo-classic': 'gpt-3.5-turbo',
  'gpt-4-0613': 'gpt-4',
  'gpt-4-next': 'gpt-4',
  'gpt-4-classic': 'gpt-4',
  'gpt-3.5-turbo-16k-0613': 'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-16k-next': 'gpt-3.5-turbo-16k-0613',
  'gpt-3.5-turbo-16k-classic': 'gpt-3.5-turbo-16k-0613',
  'gpt-3.5-turbo-16k': 'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-0613': 'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0301': 'gpt-3.5-turbo-1106',
  'text-davinci-003': 'gpt-3.5-turbo-instruct',
  'text-davinci-002': 'gpt-3.5-turbo-instruct',
  'text-davinci-001': 'gpt-3.5-turbo-instruct',
  'text-curie-001': 'gpt-3.5-turbo-instruct',
  'text-babbage-001': 'gpt-3.5-turbo-instruct',
  'text-ada-001': 'gpt-3.5-turbo-instruct',
  'davinci-instruct-beta': 'gpt-3.5-turbo-instruct',
  'code-davinci-002': 'gpt-3.5-turbo-instruct',

  // Vertex
  'gemini-3-pro': 'gemini-3.1-pro',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',

  // Anthropic
  'claude-4.1-opus': 'claude-4.5-opus',
  'claude-3.5-haiku': 'claude-4.5-haiku',
  'claude-3.7-sonnet': 'claude-4-sonnet',
  'claude-3.5-sonnet': 'claude-3.7-sonnet',
  'claude-v3-opus': 'claude-4-opus',
  'claude-v3-sonnet': 'claude-3.5-sonnet',
  'claude-v3-haiku': 'claude-3.5-haiku',
  'claude-v3': 'claude-3.5-sonnet',
  'claude-v2.1': 'claude-3.5-sonnet',
  'claude-v2': 'claude-3.5-sonnet',
  'claude-instant-v1': 'claude-3.5-haiku',

  // Deepseek
  'deepseek-chat': 'deepseek-v3.2',

  // Step
  'step-3.5-flash': 'kimi-k2.5',

  // Xiaomi
  'mimo-v2-pro': 'mimo-v2.5-pro',
  'mimo-v2-flash': 'mimo-v2.5',

  // ChatBotKit
  'text-algo-004': 'gpt-4o',
  'text-algo-003': 'gpt-4',
  'text-algo-002': 'gpt-3.5-turbo',
  'text-algo-001': 'gpt-3.5-turbo-instruct',
  'text-peopleai-002': 'gpt-3.5-turbo-instruct',
  'text-peopleai-001': 'gpt-3.5-turbo-instruct',
}

/**
 * Builds deprecated language model entries from a mapping dictionary. Each
 * entry copies all parameters from the resolved proxy target and overrides
 * provider, description, visibility, and deprecated flag.
 *
 * @throws {Error} If a proxy target is not found in the models map.
 */
function buildDeprecatedLanguageModels(
  mapping: Record<string, string>,
  models: Record<string, AnyLanguageModel>
): Record<string, AnyLanguageModel> {
  const result: Record<string, AnyLanguageModel> = {}

  for (const [name, proxyTo] of Object.entries(mapping)) {
    // resolve chain to find ultimate non-deprecated target
    let target = proxyTo

    while (mapping[target]) {
      target = mapping[target]
    }

    const targetModel = models[target]

    if (!targetModel) {
      // @note: target model may be absent because its provider feature flag is
      // disabled; in that case, skip the deprecated alias rather than throw -
      // if the provider is off, none of its aliases should be exposed either.
      continue
    }

    result[name] = {
      ...targetModel,
      description: DEPRECATED_LANGUAGE_MODEL_DESCRIPTION,
      provider: 'none',
      visible: false,
      deprecated: true,
      proxyToModel: proxyTo,
    }
  }

  return result
}

/**
 * All configured (non-deprecated) language models from all providers.
 *
 */
const configuredLanguageModels: Record<string, AnyLanguageModel> = {
  ...openrouterLanguageModels,
  ...vercelLanguageModels,
  ...cloudflareLanguageModels,
  ...openaiLanguageModels,
  ...vertexLanguageModels,
  ...bedrockLanguageModels,
  ...perplexityLanguageModels,
  ...mistralLanguageModels,
  ...groqLanguageModels,
  ...deepseekLanguageModels,
  ...chatbotkitLanguageModels,
}

export const deprecatedLanguageModels: Record<string, AnyLanguageModel> =
  buildDeprecatedLanguageModels(
    deprecatedLanguageModelProxyMapping,
    configuredLanguageModels
  )

export const noneLanguageModels: Record<string, AnyLanguageModel> =
  deprecatedLanguageModels

export const languageModels: Record<string, AnyLanguageModel> = {
  ...configuredLanguageModels,
  ...deprecatedLanguageModels,
}

/**
 * The default language model is the current flagship model when the
 * deployment serves it. A deployment without the flagship's provider falls
 * back to `custom`, which resolves to nothing on purpose: the server fails
 * with a configuration message rather than a phantom model name, and the
 * selector opens the custom (bring-your-own-model) options.
 */
export const defaultLanguageModel: string = languageModels['gpt-5.4-mini']
  ? 'gpt-5.4-mini'
  : 'custom'

/**
 * The base language model is the model that has 1:1 token ratio. It is used to
 * calculate the token ratio for other models.
 */
export const baseLanguageModel = 'base'

/**
 */
export const visibleLanguageModels: Record<string, AnyLanguageModel> =
  Object.fromEntries(
    Object.entries(languageModels).filter(([, { visible }]) => visible)
  )

// ---
// ---
// ---

// @note gated per provider, like the language catalogue above. A deployment
// offers image models only from providers it holds a credential for.

export const openaiImageModels: Record<string, AnyImageModel> =
  WITH_OPENAI_MODELS
    ? {
        'gpt-image-2': {
          description: `GPT Image 2 is OpenAI's latest image generation and editing model. It is a natively multimodal language model that accepts both text and image inputs, and produces image outputs with improved fidelity and editing capabilities.`,

          provider: 'openai',

          providerModel: 'gpt-image-2',

          family: 'gpt-image',

          features: [],

          pricing: {
            // @note per-image, derived from Vercel per-token rates ($5/M in, $30/M
            // out) × 2000 (input) / 7000 (output) tokens per HQ image.
            tokenRatio: 11666.6667,
            inputTokenRatio: 714.2857,
            outputTokenRatio: 11666.6667,
            inputPrice: 0.01,
            outputPrice: 0.21,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-04-21',
        },

        'gpt-image-1.5': {
          description: `GPT Image 1.5 is an advanced image generation model with improved quality and capabilities. It is a natively multimodal language model that accepts both text and image inputs, and produces image outputs with enhanced fidelity.`,

          provider: 'openai',

          providerModel: 'gpt-image-1.5',

          family: 'gpt-image',

          features: [],

          pricing: {
            // @note per-image, derived from per-token rates ($8/M in, $32/M out)
            // × 2000 (input) / 7000 (output) tokens per HQ image.
            tokenRatio: 12444.4444,
            inputTokenRatio: 1142.8571,
            outputTokenRatio: 12444.4444,
            inputPrice: 0.016,
            outputPrice: 0.224,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-01-15',
        },

        'gpt-image-1-mini': {
          description: `GPT Image 1 Mini is a state-of-the-art image generation model. It is a natively multimodal language model that accepts both text and image inputs, and produces image outputs.`,

          provider: 'openai',

          providerModel: 'gpt-image-1-mini',

          family: 'gpt-image',

          features: [],

          pricing: {
            // @note per-image, derived from per-token rates ($2.5/M in, $8/M out)
            // × 2000 (input) / 7000 (output) tokens per HQ image.
            tokenRatio: 3111.1111,
            inputTokenRatio: 285.7143,
            outputTokenRatio: 3111.1111,
            inputPrice: 0.004,
            outputPrice: 0.056,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2025-10-14',
        },

        'gpt-image-1': {
          description: `GPT Image 1 is a state-of-the-art image generation model. It is a natively multimodal language model that accepts both text and image inputs, and produces image outputs.`,

          provider: 'openai',

          providerModel: 'gpt-image-1',

          family: 'gpt-image',

          features: [],

          pricing: {
            // @note per-image, derived from per-token rates ($10/M in, $40/M out)
            // × 2000 (input) / 7000 (output) tokens per HQ image.
            tokenRatio: 15555.5556,
            inputTokenRatio: 714.2857,
            outputTokenRatio: 15555.5556,
            inputPrice: 0.01,
            outputPrice: 0.28,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2025-04-24',
        },

        dalle3: {
          description: `This model is based on the DALL-E 3 architecture. It is a high-quality model that can generate images from text. It is tunable and offers a balance between cost and quality.`,

          provider: 'openai',

          providerModel: 'dall-e-3',

          family: 'dalle',

          features: [],

          pricing: {
            // @note per-image, OpenAI published HD 1024×1024 rate. Input is symmetric
            // since DALL-E 3 does not separately price input images.
            tokenRatio: 4444.4444,
            inputTokenRatio: 5714.2857,
            outputTokenRatio: 4444.4444,
            inputPrice: 0.08,
            outputPrice: 0.08,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],
        },

        dalle2: {
          description: `This model is based on the DALL-E 2 architecture. It is a high-quality model that can generate images from text. It is tunable and offers a balance between cost and quality.`,

          provider: 'openai',

          providerModel: 'dall-e-2',

          family: 'dalle',

          features: [],

          pricing: {
            // @note per-image, OpenAI published 1024×1024 rate. Input is symmetric
            // since DALL-E 2 does not separately price input images.
            tokenRatio: 1111.1111,
            inputTokenRatio: 1428.5714,
            outputTokenRatio: 1111.1111,
            inputPrice: 0.02,
            outputPrice: 0.02,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],
        },
      }
    : {}

export const vercelImageModels: Record<string, AnyImageModel> =
  WITH_VERCEL_MODELS
    ? {
        'gemini-3.1-flash-lite-image': {
          description: `Gemini 3.1 Flash Lite Image is Google's fast, lower-cost image generation and editing model optimized for high-volume visual workflows. It provides efficient image creation and iterative edits for cost-sensitive production use.`,

          provider: 'vercel',

          providerModel: 'google/gemini-3.1-flash-lite-image',

          providerOptions: {
            gateway: {
              only: ['vertex'],
            },
          },

          family: 'gemini',

          features: [],

          pricing: {
            tokenRatio: 1888.8889,
            inputTokenRatio: 2428.5714,
            outputTokenRatio: 1888.8889,
            inputPrice: 0.034,
            outputPrice: 0.034,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-06-30',
        },

        'gemini-3.1-flash-image': {
          description: `Gemini 3.1 Flash Image (also known as "Nano Banana 2") is Google's latest image generation and editing model delivering Pro-level visual quality at Flash speed. It combines advanced contextual understanding with fast, cost-efficient inference for complex image generation and iterative edits.`,

          provider: 'vercel',

          providerModel: 'google/gemini-3.1-flash-image-preview',

          providerOptions: {
            gateway: {
              only: ['vertex'],
            },
          },

          family: 'gemini',

          features: [],

          pricing: {
            tokenRatio: 8388.8889,
            inputTokenRatio: 10785.7143,
            outputTokenRatio: 8388.8889,
            inputPrice: 0.151,
            outputPrice: 0.151,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-02-26',
        },

        'gemini-3-pro-image': {
          description: `Gemini 3 Pro Image (also known as "Nano Banana Pro") is Google's advanced native image generation model for professional and creative workflows, with accurate diagram labeling, web-search-grounded imagery, higher resolution output, and stronger multi-image compositing.`,

          provider: 'vercel',

          providerModel: 'google/gemini-3-pro-image',

          providerOptions: {
            gateway: {
              only: ['vertex'],
            },
          },

          family: 'gemini',

          features: [],

          pricing: {
            tokenRatio: 13333.3333,
            inputTokenRatio: 17142.8571,
            outputTokenRatio: 13333.3333,
            inputPrice: 0.24,
            outputPrice: 0.24,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2025-09-01',
        },

        'gemini-2.5-flash-image': {
          description: `Gemini 2.5 Flash Image (also known as "Nano Banana") is Google's state-of-the-art multimodal image generation model. It excels at text-to-image and image-to-image generation with high quality and fast inference.`,

          provider: 'vercel',

          providerModel: 'google/gemini-2.5-flash-image',

          providerOptions: {
            gateway: {
              only: ['vertex'],
            },
          },

          family: 'gemini',

          features: [],

          pricing: {
            tokenRatio: 2166.6667,
            inputTokenRatio: 2785.7143,
            outputTokenRatio: 2166.6667,
            inputPrice: 0.039,
            outputPrice: 0.039,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2025-01-15',
        },

        // xai

        'grok-imagine-image-2.0': {
          description: `Grok Imagine Image 2.0 is xAI's latest image generation model available through Vercel AI Gateway. It generates high-quality images from text prompts, with a higher-resolution 2048x2048 output tier.`,

          provider: 'vercel',

          providerModel: 'spacexai/grok-imagine-image-2.0',

          // @note the gateway types the Imagine family as image models rather
          // than as language models that emit images, so they have no chat
          // surface at all - a chat completion is rejected outright with a
          // ModelTypeMismatchError. They are served by the image generation API.
          providerApi: 'image',

          family: 'grok',

          features: [],

          // @note priced off the most expensive tier the model publishes
          // (2048x2048 at $0.08/image); the platform bills a single per-image
          // rate across the size/quality range.
          pricing: {
            tokenRatio: 4444.4444,
            inputTokenRatio: 5714.2857,
            outputTokenRatio: 4444.4444,
            inputPrice: 0.08,
            outputPrice: 0.08,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-08-20',
        },
      }
    : {}

export const imageModels: Record<string, AnyImageModel> = {
  ...openaiImageModels,
  ...vercelImageModels,
}

// @note the preferred default holds only when the deployment serves it;
// otherwise the first visible model of the catalogue stands in. An empty
// catalogue keeps the preferred name - nothing can resolve either way, and
// the error then names the real flagship rather than an empty string.
function pickDefaultModel(
  preferred: string,
  catalogue: Record<string, { visible?: boolean }>
): string {
  if (catalogue[preferred]) {
    return preferred
  }

  const fallback =
    Object.entries(catalogue).find(([, { visible }]) => visible)?.[0] ||
    Object.keys(catalogue)[0]

  return fallback || preferred
}

export const defaultImageModel: string = pickDefaultModel(
  'gpt-image-2',
  imageModels
)

export const visibleImageModels: Record<string, AnyImageModel> =
  Object.fromEntries(
    Object.entries(imageModels).filter(([, { visible }]) => visible)
  )

// ---
// ---
// ---

// @note gated per provider, like the catalogues above.

export const vercelVideoModels: Record<string, AnyVideoModel> =
  WITH_VERCEL_MODELS
    ? {
        'veo-3.1': {
          description: `Veo 3.1 is Google's latest video generation model available through Vercel AI Gateway. It supports text-to-video and image-to-video generation with common video controls such as duration, aspect ratio, and resolution.`,

          provider: 'vercel',

          providerModel: 'google/veo-3.1-generate-001',

          providerOptions: {
            gateway: {
              only: ['vertex'],
            },
          },

          family: 'veo',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: ['16:9', '9:16'],
          resolution: '720p',
          availableResolutions: ['720p', '1080p'],
          duration: 8,
          availableDurations: [4, 6, 8],
          fps: 24,

          pricing: {
            tokenRatio: 11111.1111,
            inputTokenRatio: 14285.7143,
            outputTokenRatio: 11111.1111,
            inputPrice: 0.2,
            outputPrice: 0.2,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-03-12',
        },

        'grok-imagine-video-1.5': {
          description: `Grok Imagine Video 1.5 is xAI's latest video model available through Vercel AI Gateway. It generates video from a text prompt, from images, or from reference material, with synchronized audio and resolutions up to 1080p.`,

          provider: 'vercel',

          providerModel: 'spacexai/grok-imagine-video-1.5',

          family: 'grok',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: [
            '16:9',
            '9:16',
            '1:1',
            '4:3',
            '3:4',
            '3:2',
            '2:3',
          ],
          resolution: '480p',
          availableResolutions: ['480p', '720p', '1080p'],
          duration: 5,
          availableDurations: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
          ],
          fps: 24,

          // @note priced off the most expensive resolution the model offers
          // (1080p at $0.25/s); the platform bills a single per-second rate
          // across the resolution range.
          pricing: {
            tokenRatio: 13888.8889,
            inputTokenRatio: 17857.1429,
            outputTokenRatio: 13888.8889,
            inputPrice: 0.25,
            outputPrice: 0.25,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-08-20',
        },

        // @note kept alongside grok-imagine-video-1.5 rather than retired onto
        // it: 1.5 advertises no video-editing or extend-video operation, so
        // this is still the only Vercel-side model that can edit or extend an
        // existing video (see editVideo in lib/video.ts).
        'grok-imagine-video': {
          description: `Grok Imagine Video is xAI's video model available through Vercel AI Gateway. It supports video generation and prompt-based edits of existing videos through provider options.`,

          provider: 'vercel',

          providerModel: 'spacexai/grok-imagine-video',

          family: 'grok',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: [
            '16:9',
            '9:16',
            '1:1',
            '4:3',
            '3:4',
            '3:2',
            '2:3',
          ],
          resolution: '480p',
          availableResolutions: ['480p', '720p'],
          duration: 5,
          availableDurations: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
          ],

          pricing: {
            tokenRatio: 3888.8889,
            inputTokenRatio: 5000,
            outputTokenRatio: 3888.8889,
            inputPrice: 0.07,
            outputPrice: 0.07,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-03-12',
        },

        'seedance-2.5': {
          description: `Seedance 2.5 is ByteDance's next-generation audio-video joint generation model available through Vercel AI Gateway. It is built for up to 30 seconds of storytelling with precise reference control, video editing, and video extension.`,

          provider: 'vercel',

          providerModel: 'bytedance/seedance-2.5',

          family: 'seedance',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
          resolution: '720p',
          availableResolutions: ['480p', '720p', '1080p'],
          duration: 5,
          availableDurations: [
            4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
            22, 23, 24, 25, 26, 27, 28, 29, 30,
          ],
          fps: 24,

          // @note the gateway prices this family per video TOKEN, not per
          // second, and publishes no tokens-per-second figure - so the absolute
          // price cannot be read off the catalogue (the vercel catalogue test
          // skips the price diff for token-priced video models and asserts only
          // the ratios). The per-second rate here is carried over from the
          // seedance-2.0 entry in cloudflareVideoModels ($0.55/s) scaled by the
          // ratio of the two models' published top-resolution token rates
          // (11.7 vs 7.7 per million), which keeps the family's relative pricing
          // coherent: 0.55 * 11.7 / 7.7 ~= 0.84.
          pricing: {
            tokenRatio: 46666.6667,
            inputTokenRatio: 60000,
            outputTokenRatio: 46666.6667,
            inputPrice: 0.84,
            outputPrice: 0.84,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-08-20',
        },
      }
    : {}

export const cloudflareVideoModels: Record<string, AnyVideoModel> =
  WITH_CLOUDFLARE_MODELS
    ? {
        'seedance-2.0': {
          description: `Seedance 2.0 is ByteDance's second-generation video model available through Cloudflare AI. It supports text-to-video, image-to-video, multimodal reference-to-video, synchronized audio generation, video editing, and video extension.`,

          provider: 'cloudflare',

          providerModel: 'bytedance/seedance-2.0',

          family: 'seedance',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
          resolution: '720p',
          availableResolutions: ['480p', '720p', '1080p'],
          duration: 5,
          availableDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
          fps: 24,

          pricing: {
            tokenRatio: 30555.5556,
            inputTokenRatio: 39285.7143,
            outputTokenRatio: 30555.5556,
            inputPrice: 0.55,
            outputPrice: 0.55,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-04-14',
        },

        'seedance-2.0-fast': {
          description: `Seedance 2.0 Fast is ByteDance's speed-optimized Seedance 2.0 variant available through Cloudflare AI. It keeps Seedance 2.0's multimodal video inputs, audio capabilities, and editing support while prioritizing faster generation and lower cost.`,

          provider: 'cloudflare',

          providerModel: 'bytedance/seedance-2.0-fast',

          family: 'seedance',

          features: [],

          aspectRatio: '16:9',
          availableAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
          resolution: '720p',
          availableResolutions: ['480p', '720p'],
          duration: 5,
          availableDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
          fps: 24,

          pricing: {
            tokenRatio: 9444.4444,
            inputTokenRatio: 12142.8571,
            outputTokenRatio: 9444.4444,
            inputPrice: 0.17,
            outputPrice: 0.17,
          },

          region: 'us',
          availableRegions: ['us'],

          visible: true,
          deprecated: false,

          tags: [],

          addedDate: '2026-04-14',
        },
      }
    : {}

export const videoModels: Record<string, AnyVideoModel> = {
  ...vercelVideoModels,
  ...cloudflareVideoModels,
}

export const defaultVideoModel: string = pickDefaultModel(
  'veo-3.1',
  videoModels
)

export const visibleVideoModels: Record<string, AnyVideoModel> =
  Object.fromEntries(
    Object.entries(videoModels).filter(([, { visible }]) => visible)
  )

// ---
// ---
// ---

export const rerankModels: Record<string, AnyRerankModel> = {
  'rerank-v4-fast': {
    description: `Cohere Rerank 4 Fast is the speed-optimized tier of Cohere's Rerank 4 generation, available through Vercel AI Gateway. It reranks candidate documents against a query for improved retrieval-augmented generation, tuned for lower per-query latency and higher throughput.`,

    provider: 'vercel',

    providerModel: 'cohere/rerank-v4-fast',

    family: 'rerank',

    features: [],

    pricing: {
      // @note per-search; cohere/rerank-v4-fast bills $2 per 1K searches
      // ($0.002/search). usage reports one search per call (inputTokens 0,
      // outputTokens 1) so the per-call cost is carried on outputPrice. See
      // model.provider.vercel.rerank().
      tokenRatio: 111.1111,
      inputTokenRatio: 0,
      outputTokenRatio: 111.1111,
      inputPrice: 0,
      outputPrice: 0.002,
    },

    region: 'us',
    availableRegions: ['us'],

    visible: true,
    deprecated: false,

    tags: [],

    addedDate: '2026-06-17',
  },

  'rerank-v4-pro': {
    description: `Cohere Rerank 4 Pro is the quality tier of Cohere's Rerank 4 generation, available through Vercel AI Gateway. It is Cohere's strongest reranker, aimed at enterprise search and RAG pipelines where ranking accuracy on complex queries drives downstream outcomes.`,

    provider: 'vercel',

    providerModel: 'cohere/rerank-v4-pro',

    family: 'rerank',

    features: [],

    pricing: {
      // @note per-search; cohere/rerank-v4-pro bills $2.5 per 1K searches
      // ($0.0025/search), carried on outputPrice (one search per call).
      tokenRatio: 138.8889,
      inputTokenRatio: 0,
      outputTokenRatio: 138.8889,
      inputPrice: 0,
      outputPrice: 0.0025,
    },

    region: 'us',
    availableRegions: ['us'],

    visible: true,
    deprecated: false,

    tags: [],

    addedDate: '2026-06-17',
  },

  // @note rerank-v3.5 (cohere/rerank-v3.5) was removed: the Vercel AI Gateway
  // only serves it via AWS Bedrock, whose reranking path is broken at the gateway
  // (rerankingConfiguration.bedrockRerankingConfiguration comes through null →
  // 400), so every call failed. Datasets are migrated to rerank-v4-fast (same
  // vendor, current generation) by migrations/<ts>-migrate-rerank-v35-to-v4-fast.

  'rerank-2.5': {
    description: `Voyage Rerank 2.5 is Voyage AI's reranking model, available through Vercel AI Gateway. It reranks candidate documents against a query for improved retrieval-augmented generation pipelines.`,

    provider: 'vercel',

    providerModel: 'voyage/rerank-2.5',

    family: 'rerank',

    features: [],

    pricing: {
      // @note rough per-search estimate. voyage/rerank-2.5 bills per input token
      // ($0.05/M, output free) and the gateway publishes no per-search price, so
      // we approximate one search as ~10K input tokens (query + ~20 candidates)
      // → ~$0.0005, carried on outputPrice to match the per-call usage unit
      // (inputTokens 0, outputTokens 1). Revisit with real token accounting.
      tokenRatio: 27.7778,
      inputTokenRatio: 0,
      outputTokenRatio: 27.7778,
      inputPrice: 0,
      outputPrice: 0.0005,
    },

    region: 'us',
    availableRegions: ['us'],

    visible: false,
    deprecated: false,

    tags: [],

    addedDate: '2026-06-17',
  },

  'rerank-2.5-lite': {
    description: `Voyage Rerank 2.5 Lite is the lightweight, lower-cost variant of Voyage AI's Rerank 2.5 model, available through Vercel AI Gateway. It prioritizes lower latency while retaining strong reranking quality.`,

    provider: 'vercel',

    providerModel: 'voyage/rerank-2.5-lite',

    family: 'rerank',

    features: [],

    pricing: {
      // @note rough per-search estimate (see rerank-2.5 above). The lite tier is
      // cheaper per token, approximated here at ~40% of rerank-2.5 → ~$0.0002 per
      // search on outputPrice. Revisit with real token accounting.
      tokenRatio: 11.1111,
      inputTokenRatio: 0,
      outputTokenRatio: 11.1111,
      inputPrice: 0,
      outputPrice: 0.0002,
    },

    region: 'us',
    availableRegions: ['us'],

    visible: false,
    deprecated: false,

    tags: [],

    addedDate: '2026-06-17',
  },
}

export const defaultRerankModel: string = pickDefaultModel(
  'rerank-v4-fast',
  rerankModels
)

export const visibleRerankModels: Record<string, AnyRerankModel> =
  Object.fromEntries(
    Object.entries(rerankModels).filter(([, { visible }]) => visible)
  )

// ---
// ---
// ---

export const speechToTextModels: Record<string, AnySpeechToTextModel> = {
  'gpt-4o-transcribe': {
    description: `GPT-4o Transcribe is OpenAI's speech-to-text model for audio transcription.`,

    provider: 'openai',

    family: 'gpt-4o',

    features: ['audio'],

    region: 'us',
    availableRegions: ['us'],

    visible: false,
    deprecated: false,

    tags: [],
  },
}

export const defaultSpeechToTextModel: string = pickDefaultModel(
  'gpt-4o-transcribe',
  speechToTextModels
)

export const visibleSpeechToTextModels: Record<string, AnySpeechToTextModel> =
  Object.fromEntries(
    Object.entries(speechToTextModels).filter(([, { visible }]) => visible)
  )

// ---
// ---
// ---

export const textToSpeechModels: Record<string, AnyTextToSpeechModel> = {
  'tts-1': {
    description: `TTS-1 is OpenAI's text-to-speech model for generating spoken audio from text.`,

    provider: 'openai',

    family: 'tts',

    features: ['audio'],

    region: 'us',
    availableRegions: ['us'],

    visible: false,
    deprecated: false,

    tags: [],
  },
}

export const defaultTextToSpeechModel: string = pickDefaultModel(
  'tts-1',
  textToSpeechModels
)

export const visibleTextToSpeechModels: Record<string, AnyTextToSpeechModel> =
  Object.fromEntries(
    Object.entries(textToSpeechModels).filter(([, { visible }]) => visible)
  )

/**
 *
 */
export const visibleModels = {
  ...visibleLanguageModels,
  ...visibleImageModels,
}

// @note the default export mirrors the sibling config packages, which each
// export their configuration value as the default. For the catalogue that
// value is the canonical aggregate surface; the per-provider maps stay
// named-only.

const models = {
  languageModels,
  defaultLanguageModel,
  baseLanguageModel,
  visibleLanguageModels,

  imageModels,
  defaultImageModel,
  visibleImageModels,

  videoModels,
  defaultVideoModel,
  visibleVideoModels,

  rerankModels,
  defaultRerankModel,
  visibleRerankModels,

  speechToTextModels,
  defaultSpeechToTextModel,
  visibleSpeechToTextModels,

  textToSpeechModels,
  defaultTextToSpeechModel,
  visibleTextToSpeechModels,

  visibleModels,
}

export default models
