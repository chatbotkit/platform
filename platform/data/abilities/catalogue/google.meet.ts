import {
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  RECORDING_LIST_HANDLER_NAME,
  RECORDING_TRANSCRIPT_FETCH_HANDLER_NAME,
  RecordingListSchema,
  RecordingTranscriptFetchSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/meet'

// --- Path Constants ---

const MEET_API_PATH = '/api/auxiliary/skillset/ability/google/meet'

/**
 * Catalogue of Google Meet abilities.
 */
const abilities = {
  // --- Recording Abilities ---

  'google/meet/recording/list': createAuxiliaryTemplate<RecordingListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Meet Recordings',
    description: 'List all Google Meet recordings.',
    tags: ['google', 'meet', 'recording', 'list'],
    path: MEET_API_PATH,
    handler: 'recording/list' satisfies typeof RECORDING_LIST_HANDLER_NAME,
    secret: '@platform/google/meet',
    instruction: {},
    options: {
      auth: 'internal',
    },
  }),

  'google/meet/recording/transcript/fetch':
    createAuxiliaryTemplate<RecordingTranscriptFetchSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Fetch Google Meet Recording Transcript',
      description: 'Fetch the transcript of a Google Meet recording.',
      tags: ['google', 'meet', 'recording', 'transcript', 'fetch'],
      path: MEET_API_PATH,
      handler:
        'recording/transcript/fetch' satisfies typeof RECORDING_TRANSCRIPT_FETCH_HANDLER_NAME,
      secret: '@platform/google/meet',
      instruction: {
        id: field({
          name: 'id',
          description: 'the recording ID',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Pack Abilities ---

  'pack/google/meet': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Meet Tools',
    description:
      'Installs Google Meet tools into the conversation. You can list recordings and fetch transcripts.',
    tags: ['google', 'meet', 'pack', 'beta'],
    secret: '@platform/google/meet',
    instruction: {
      abilities: [
        'google/meet/recording/list',
        'google/meet/recording/transcript/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
