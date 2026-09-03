import {
  array,
  createImageCreateTemplate,
  createImageEditTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit image abilities.
 *
 * These abilities provide image generation and modification capabilities using
 * various AI image models including gpt-image-2, gpt-image-1, gpt-image-1.5,
 * dalle3, dalle2, stablediffusion, gemini-2.5-flash-image,
 * gemini-3.1-flash-image, and gemini-3.1-flash-lite-image.
 */
const abilities = {
  'image/generate': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description: 'Generate an image from the provided input prompt.',
    tags: ['image', 'generation'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      model: field({
        name: 'model',
        description: 'the image model to use',
        placeholder: true,
      }),
    },
  }),

  'image/modify': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images and a provided input prompt.',
    tags: ['image', 'modification'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: field({
        name: 'model',
        description: 'the image model to use',
        placeholder: true,
      }),
    },
  }),

  'image/generate[gpt-image-2]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description:
      "Generate an image using the GPT Image 2 model with OpenAI's latest image generation capabilities.",
    tags: ['image', 'gpt-image-2'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gpt-image-2',
    },
  }),

  'image/modify[gpt-image-2]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images using the GPT Image 2 model.',
    tags: ['image', 'gpt-image-2'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gpt-image-2',
    },
  }),

  'image/generate[gpt-image-1.5]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description:
      'Generate an image using the GPT Image 1.5 model with enhanced quality and fidelity.',
    tags: ['image', 'gpt-image-1.5'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gpt-image-1.5',
    },
  }),

  'image/modify[gpt-image-1.5]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images using the GPT Image 1.5 model.',
    tags: ['image', 'gpt-image-1.5'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gpt-image-1.5',
    },
  }),

  'image/generate[gpt-image-1]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description: 'Generate an image from the provided input prompt.',
    tags: ['image', 'gpt-image-1'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gpt-image-1',
    },
  }),

  'image/modify[gpt-image-1]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images and a provided input prompt.',
    tags: ['image', 'gpt-image-1'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gpt-image-1',
    },
  }),

  'image/generate[gemini-2.5-flash-image]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description:
      'Generate an image using the Gemini 2.5 Flash Image model (also known as "Nano Banana") with state-of-the-art contextual understanding.',
    tags: ['image', 'gemini-2.5-flash-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gemini-2.5-flash-image',
    },
  }),

  'image/modify[gemini-2.5-flash-image]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images using the Gemini 2.5 Flash Image model (also known as "Nano Banana").',
    tags: ['image', 'gemini-2.5-flash-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gemini-2.5-flash-image',
    },
  }),

  'image/generate[gemini-3.1-flash-image]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description:
      'Generate an image using the Gemini 3.1 Flash Image model with Pro-level visual quality at Flash speed.',
    tags: ['image', 'gemini-3.1-flash-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gemini-3.1-flash-image',
    },
  }),

  'image/modify[gemini-3.1-flash-image]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images using the Gemini 3.1 Flash Image model.',
    tags: ['image', 'gemini-3.1-flash-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gemini-3.1-flash-image',
    },
  }),

  'image/generate[gemini-3.1-flash-lite-image]': createImageCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Generate Image',
    description:
      'Generate an image using the Gemini 3.1 Flash Lite Image model, a fast, lower-cost option optimized for high-volume visual workflows.',
    tags: ['image', 'gemini-3.1-flash-lite-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to generate the image',
        optional: true,
      }),
      model: 'gemini-3.1-flash-lite-image',
    },
  }),

  'image/modify[gemini-3.1-flash-lite-image]': createImageEditTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Modify Image',
    description:
      'Create a new image from previous input images using the Gemini 3.1 Flash Lite Image model.',
    tags: ['image', 'gemini-3.1-flash-lite-image'],
    instruction: {
      prompt: field({
        name: 'prompt',
        description: 'the prompt to use for image generation',
        placeholder: true,
      }),
      directions: field({
        name: 'directions',
        description: 'detailed directions how to modify the image',
        optional: true,
      }),
      images: array({
        items: field({
          name: 'image_url',
          description: 'the URL of the image to edit',
          placeholder: true,
        }),
        minItems: 1,
        maxItems: 3,
      }),
      model: 'gemini-3.1-flash-lite-image',
    },
  }),
}

export default abilities
