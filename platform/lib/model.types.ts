// @note the model catalogue contract. These types describe the shape of a
// model entry, not which models exist: the catalogue itself lives in
// @/config/models. They were folded in here from the former
// @chatbotkit-dev/config-models-spec package when the catalogue became a
// single, non-swappable configuration.

/**
 * MODEL
 */

export type Model = {
  description: string
  provider: string
  providerOptions?: Record<string, unknown>
  family: string
  features: (
    | 'text'
    | 'chat'
    | 'file'
    | 'image'
    | 'audio'
    | 'video'
    | 'realtime'
    | 'responses'
    | 'functions'
    | 'interpreter'
    | 'reasoning'
  )[]
  region: 'us' | 'eu'
  availableRegions: ('us' | 'eu')[]
  visible: boolean
  deprecated: boolean
  proxyToModel?: string
  providerModel?: string
  tags: string[]
  addedDate?: string
  featured?: boolean
}

/**
 * LANGUAGE
 */

export type LanguageModel = Model & {
  requiresUserTurnBeforeToolCall?: boolean
  requiresUserTurnAsLastMessage?: boolean
  temperature: number
  frequencyPenalty: number
  presencePenalty: number
  maxTokens: number
  maxInputTokens: number
  maxOutputTokens: number
  pricing: {
    tokenRatio: number
    inputTokenRatio?: number
    outputTokenRatio?: number
    inputPrice?: number
    outputPrice?: number
  }
  interactionMaxMessages: number
  thresholdStrategy: 'compact' | 'truncate'
  voice?: string
  availableVoices?: string[]
}

export type TextModel = LanguageModel

export type ChatModel = LanguageModel

// ---

export type OpenAITextModel = TextModel & {
  provider: 'openai'
}

export type OpenAIChatModel = ChatModel & {
  provider: 'openai'
  forceFunction?: string
}

export type OpenAILanguageModel = OpenAITextModel | OpenAIChatModel

// ---

export type OpenrouterTextModel = TextModel & {
  provider: 'openrouter'
}

export type OpenrouterChatModel = ChatModel & {
  provider: 'openrouter'
}

export type OpenrouterLanguageModel = OpenrouterTextModel | OpenrouterChatModel

// ---

export type VertexTextModel = TextModel & {
  provider: 'vertex'
}

export type VertexChatModel = ChatModel & {
  provider: 'vertex'
}

export type VertexLanguageModel = VertexTextModel | VertexChatModel

// ---

export type BedrockTextModel = TextModel & {
  provider: 'bedrock'
}

export type BedrockChatModel = ChatModel & {
  provider: 'bedrock'
}

export type BedrockLanguageModel = BedrockTextModel | BedrockChatModel

// ---

export type VercelTextModel = Omit<TextModel, 'providerOptions'> & {
  provider: 'vercel'

  providerOptions?: {
    gateway?: {
      zeroDataRetention?: boolean
      order?: string[]
      only?: string[]
    }
  }
}

export type VercelChatModel = Omit<ChatModel, 'providerOptions'> & {
  provider: 'vercel'

  providerOptions?: {
    gateway?: {
      zeroDataRetention?: boolean
      order?: string[]
      only?: string[]
    }
  }
}

export type VercelLanguageModel = VercelTextModel | VercelChatModel

// ---

export type CloudflareTextModel = TextModel & {
  provider: 'cloudflare'
}

export type CloudflareChatModel = ChatModel & {
  provider: 'cloudflare'
}

export type CloudflareLanguageModel = CloudflareTextModel | CloudflareChatModel

// ---

export type PerplexityTextModel = TextModel & {
  provider: 'perplexity'
}

export type PerplexityChatModel = ChatModel & {
  provider: 'perplexity'
}

export type PerplexityLanguageModel = PerplexityTextModel | PerplexityChatModel

// ---

export type MistralTextModel = TextModel & {
  provider: 'mistral'
}

export type MistralChatModel = ChatModel & {
  provider: 'mistral'
}

export type MistralLanguageModel = MistralTextModel | MistralChatModel

// ---

export type GroqTextModel = TextModel & {
  provider: 'groq'
}

export type GroqChatModel = ChatModel & {
  provider: 'groq'
}

export type GroqLanguageModel = GroqTextModel | GroqChatModel

// ---

export type DeepseekTextModel = TextModel & {
  provider: 'deepseek'
}

export type DeepseekChatModel = ChatModel & {
  provider: 'deepseek'
}

export type DeepseekLanguageModel = DeepseekTextModel | DeepseekChatModel

// ---

export type ZaiTextModel = TextModel & {
  provider: 'zai'
}

export type ZaiChatModel = ChatModel & {
  provider: 'zai'
}

export type ZaiLanguageModel = ZaiTextModel | ZaiChatModel

// ---

export type MoonshotTextModel = TextModel & {
  provider: 'moonshot'
}

export type MoonshotChatModel = ChatModel & {
  provider: 'moonshot'
}

export type MoonshotLanguageModel = MoonshotTextModel | MoonshotChatModel

// ---

export type QwenTextModel = TextModel & {
  provider: 'qwen'
}

export type QwenChatModel = ChatModel & {
  provider: 'qwen'
}

export type QwenLanguageModel = QwenTextModel | QwenChatModel

// ---

export type ChatBotKitBaseModel = TextModel & {
  provider: 'chatbotkit'
}

export type ChatBotKitTextModel = TextModel & {
  provider: 'chatbotkit'
  proxyToModel: string
}

export type ChatBotKitChatModel = ChatModel & {
  provider: 'chatbotkit'
  proxyToModel: string
  forceFunction?: string
}

export type ChatBotKitLanguageModel =
  | ChatBotKitBaseModel
  | ChatBotKitTextModel
  | ChatBotKitChatModel

// ---

export type DeprecatedLanguageModel = LanguageModel & {
  provider: 'none'
  proxyToModel: string
}

// ---

export type AnyLanguageModel =
  | OpenAILanguageModel
  | OpenrouterLanguageModel
  | VertexLanguageModel
  | BedrockLanguageModel
  | VercelLanguageModel
  | CloudflareLanguageModel
  | PerplexityLanguageModel
  | MistralLanguageModel
  | GroqLanguageModel
  | DeepseekLanguageModel
  | ZaiLanguageModel
  | MoonshotLanguageModel
  | QwenLanguageModel
  | ChatBotKitLanguageModel
  | DeprecatedLanguageModel

/**
 * IMAGE
 */

export type ImageModel = Model & {
  // @todo add model options here

  pricing: {
    tokenRatio: number
    inputTokenRatio?: number
    outputTokenRatio?: number
    inputPrice?: number
    outputPrice?: number
  }
}

export type OpenAIImageModel = ImageModel & {
  provider: 'openai'
}

export type OpenRouterImageModel = ImageModel & {
  provider: 'openrouter'
}

export type VercelImageModel = ImageModel & {
  provider: 'vercel'

  // @note which gateway surface serves the model - see ImageProviderAPI in
  // lib/model.provider.vercel. Absent means the chat surface.
  providerApi?: 'chat' | 'image'
}

export type CloudflareImageModel = ImageModel & {
  provider: 'cloudflare'
}

// @note no Bedrock variant. Nothing ever named `bedrock` as an image provider,
// and the implementation behind it needed a second set of cloud credentials
// that the rest of the provider had no use for - see the note in
// platform/lib/model.provider.bedrock.ts.
export type AnyImageModel =
  | OpenAIImageModel
  | OpenRouterImageModel
  | VercelImageModel
  | CloudflareImageModel

/**
 * VIDEO
 */

export type VideoModel = Model & {
  aspectRatio?: string
  availableAspectRatios?: string[]

  resolution?: string
  availableResolutions?: string[]

  duration?: number
  availableDurations?: number[]

  fps?: number

  pricing: {
    tokenRatio: number
    inputTokenRatio?: number
    outputTokenRatio?: number
    inputPrice?: number
    outputPrice?: number
  }
}

export type VercelVideoModel = VideoModel & {
  provider: 'vercel'
}

export type CloudflareVideoModel = VideoModel & {
  provider: 'cloudflare'
}

export type AnyVideoModel = VercelVideoModel | CloudflareVideoModel

/**
 * RERANK
 */

export type RerankModel = Model & {
  pricing: {
    tokenRatio: number
    inputTokenRatio?: number
    outputTokenRatio?: number
    inputPrice?: number
    outputPrice?: number
  }
}

export type VercelRerankModel = RerankModel & {
  provider: 'vercel'
}

export type AnyRerankModel = VercelRerankModel

/**
 * SPEACH TO TEXT
 */

export type SpeechToTextModel = Model

export type GPTSpeechToTextModel = SpeechToTextModel

export type AnySpeechToTextModel = SpeechToTextModel

/**
 * TEXT TO SPEECH
 */

export type TextToSpeechModel = Model

export type OpenAITextToSpeechModel = TextToSpeechModel

export type AnyTextToSpeechModel = OpenAITextToSpeechModel

/**
 * @manual Language Models
 * @description Comprehensive guide to understanding language model configuration in the ChatBotKit platform
 * @category Models
 * @tags models, configuration, parameters
 * @index 5
 *
 * Language models in ChatBotKit are configured through a structured parameter system that defines their behavior, capabilities, and operational characteristics. Each model consists of several key parameters that determine how it functions within the platform, from basic identification to advanced response controls.
 *
 * Understanding these parameters helps you make informed decisions when selecting and configuring models for your specific use cases, whether you need high creativity, precise responses, or specific feature support.
 *
 * ## Core Identification Parameters
 *
 * Every language model is identified through several core parameters:
 *
 * **Provider**: Identifies the organization or service that supplies the model (e.g., 'openai', 'anthropic', 'mistral', 'vertex', 'bedrock'). Different providers offer models with varying strengths, pricing, and capabilities.
 *
 * **Family**: Groups related models together (e.g., 'glm', 'gpt-5', 'claude', 'gemini'). Models in the same family typically share similar architectures and capabilities but may differ in size, speed, or specialization.
 *
 * **Features**: An array specifying the model's capabilities, such as 'text', 'chat', 'file', 'image', 'audio', 'video', 'functions', 'interpreter', and 'reasoning'. These flags indicate which types of inputs the model can process and what operations it supports.
 *
 * ## Token Management Parameters
 *
 * Token limits define how much text the model can process and generate in a single interaction:
 *
 * **maxTokens**: The total context window size available to the model, representing the combined limit for both input and output. For example, a model with 128,000 max tokens can handle substantial conversations or documents.
 *
 * **maxInputTokens**: The maximum number of tokens that can be provided as input to the model. This typically comprises the majority of the context window (often around 75%) to allow for comprehensive prompts and conversation history.
 *
 * **maxOutputTokens**: The maximum number of tokens the model can generate in its response. This is usually a smaller portion of the context window (often around 25%) to balance input context with response generation.
 *
 * The relationship between these values is: maxTokens = maxInputTokens + maxOutputTokens. Understanding these limits helps you plan how much context to provide and what length of responses to expect.
 *
 * ## Pricing Configuration
 *
 * The pricing structure determines the cost of using a model:
 *
 * **tokenRatio**: The base cost multiplier for token usage. Higher values indicate more expensive models, often reflecting greater capability or computational requirements.
 *
 * **inputTokenRatio** (when specified): A separate pricing multiplier for input tokens. Some providers charge different rates for reading input versus generating output.
 *
 * **outputTokenRatio** (when specified): A separate pricing multiplier for output tokens. When both input and output ratios are provided, they override the base tokenRatio for more accurate cost calculations.
 *
 * ## Response Behavior Parameters
 *
 * These parameters control how the model generates responses:
 *
 * **temperature**: Controls the randomness and creativity in responses. A value of 0 produces highly deterministic, focused responses. Higher values (0.7-1.0) produce more creative and varied outputs but may be less predictable. Lower values are ideal for factual Q&A, while higher values suit creative writing or brainstorming.
 *
 * **frequencyPenalty**: Reduces repetition by penalizing tokens based on how often they appear in the generated text. Values range from -2.0 to 2.0, with positive values discouraging repetitive language and negative values allowing more repetition.
 *
 * **presencePenalty**: Encourages topic diversity by penalizing tokens that have already appeared, regardless of frequency. Like frequencyPenalty, values range from -2.0 to 2.0, helping create more varied and exploratory responses.
 *
 * **interactionMaxMessages**: Limits how many conversation messages are included in each model interaction. Lower values (2-10) make responses more focused and deterministic, while higher values (50-100) provide more context awareness but may reduce response consistency.
 *
 * ## Visibility and Lifecycle Management
 *
 * These parameters control how models appear and behave in the platform:
 *
 * **visible**: Determines whether the model appears in user-facing model selection interfaces. Models marked as not visible are available through the API but don't appear in dropdown menus, useful for testing or internal versions.
 *
 * **deprecated**: Indicates whether a model is deprecated and should be avoided for new projects. Deprecated models continue to function for existing integrations but are not recommended for new implementations.
 *
 * **proxyToModel**: Enables version aliasing where a generic model name automatically routes to a specific version. For example, 'gpt-5' might proxy to a specific dated version such as 'gpt-5.4', allowing users to request models by familiar names while the platform uses specific versions.
 *
 * ## Regional Configuration
 *
 * Geographic availability is managed through regional parameters:
 *
 * **region**: The primary region where the model is hosted ('us' or 'eu'). This affects latency and data residency for API requests.
 *
 * **availableRegions**: An array of all regions where the model can be accessed. Some models are available in multiple regions, allowing you to choose your preferred geographic location for data processing and compliance requirements.
 *
 * ## Metadata and Classification
 *
 * **tags**: An array of strings for categorizing models (e.g., 'beta', 'experimental'). Tags help identify model maturity levels, special capabilities, or testing status. Beta models may have cutting-edge features but less stability.
 *
 * ## Choosing the Right Model Configuration
 *
 * When selecting and configuring a model for your use case:
 *
 * 1. **Match features to requirements**: Choose models with features that align with your needs (e.g., image support for visual tasks, functions for tool integration).
 *
 * 2. **Balance cost and capability**: Higher-priced models typically offer better performance, but may not be necessary for simpler tasks.
 *
 * 3. **Consider token limits**: Ensure the model's context window is sufficient for your typical conversations or document processing needs.
 *
 * 4. **Adjust temperature for task type**: Use low temperature (0-0.3) for factual responses, medium (0.5-0.7) for balanced outputs, and high (0.8-1.0) for creative tasks.
 *
 * 5. **Select appropriate regions**: Choose models available in regions that meet your latency and data residency requirements.
 *
 * 6. **Monitor deprecated status**: Avoid deprecated models for new projects, but understand they'll continue working for existing integrations during transition periods.
 */

/**
 * @manual Image Models
 * @description Comprehensive guide to understanding image model configuration and pricing in the ChatBotKit platform
 * @category Models
 * @tags models, image, configuration, pricing
 * @index 10
 *
 * Image models in ChatBotKit are configured to generate images from text prompts and, in some
 * cases, from image inputs as well. They share the same core identification parameters as
 * language models but differ in that they are priced per generation rather than per token.
 *
 * Understanding the configuration fields helps you choose the right model for your visual
 * generation tasks and accurately predict costs across different providers and quality tiers.
 *
 * ## Core Identification Parameters
 *
 * Every image model is identified through the same core parameters as language models:
 *
 * **Provider**: Identifies the organization or service that supplies the model (e.g., 'openai',
 * 'bedrock', 'openrouter', 'vercel'). Different providers offer models with varying generation
 * quality, style characteristics, and pricing.
 *
 * **Family**: Groups related models together (e.g., 'gpt-image', 'dalle', 'gemini'). Models in
 * the same family share an underlying architecture but may differ in quality tier or speed.
 *
 * **Features**: An array specifying the model's capabilities. Image models typically have an
 * empty features array or use feature flags to indicate support for image input alongside text.
 *
 * ## Pricing Configuration
 *
 * Image model pricing is based on the cost per generation request rather than token consumption.
 * The pricing structure uses the following fields:
 *
 * **tokenRatio**: The base cost multiplier for generation requests. Higher values reflect more
 * capable or higher-quality models.
 *
 * **inputTokenRatio** (when specified): A separate multiplier for the input side of a request.
 * This applies to models that accept image inputs in addition to text prompts, where input
 * processing carries its own cost.
 *
 * **outputTokenRatio** (when specified): A separate multiplier for output generation. When both
 * input and output ratios are provided they override the base tokenRatio for more accurate
 * cost calculation.
 *
 * **inputPrice** (when specified): A fixed price component for input processing, expressed in
 * cost units per 1,000 requests. Used alongside outputPrice for models with distinct input
 * and output pricing.
 *
 * **outputPrice** (when specified): A fixed price component for the generated image output.
 * This is the primary pricing field for most image models, representing the cost per image
 * generated. Multiply by expected volume to estimate total generation costs.
 *
 * ## Visibility and Lifecycle Management
 *
 * The same visibility and lifecycle fields from language models apply to image models:
 *
 * **visible**: Determines whether the model appears in user-facing model selection interfaces.
 * Hidden models are accessible via the API but do not appear in dropdowns or pickers.
 *
 * **deprecated**: Indicates whether the model is deprecated and should be avoided for new
 * projects. Deprecated models continue to function for existing integrations during transition.
 *
 * ## Regional Configuration
 *
 * **region**: The primary region where the model is hosted ('us' or 'eu'). This affects latency
 * and data residency for generation requests.
 *
 * **availableRegions**: An array of all regions where the model can be accessed. Choose a region
 * that meets your latency requirements and data residency compliance obligations.
 *
 * ## Metadata and Classification
 *
 * **tags**: An array of strings for categorizing models (e.g., 'beta', 'experimental'). Tags
 * help identify model maturity and any special capabilities or testing status.
 *
 * **addedDate**: The date when the model was added to the platform. More recent models typically
 * reflect the latest provider capabilities and pricing.
 *
 * ## Choosing the Right Image Model
 *
 * When selecting and configuring an image model for your use case:
 *
 * 1. **Match the provider to your quality needs**: Different providers and families excel at
 *    different visual styles and fidelity levels. Evaluate output quality before committing.
 *
 * 2. **Balance cost and quality**: Higher outputPrice models typically produce higher-fidelity
 *    results, but may not be necessary for all tasks. Consider lower-cost models for drafts
 *    or high-volume generation.
 *
 * 3. **Account for input pricing**: Models that accept image inputs carry an additional input
 *    cost. Factor both inputPrice and outputPrice into your cost estimates for edit workflows.
 *
 * 4. **Select appropriate regions**: Choose models available in regions that meet your latency
 *    and data residency requirements.
 *
 * 5. **Monitor deprecated status**: Avoid deprecated models for new projects, but understand
 *    they will continue working for existing integrations during transition periods.
 */
