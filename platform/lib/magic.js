// @ts-check
import generateBackstoryFromText from '@/prompts/generate_backstory_from_text_v5.yaml'
import generateCronSchedule from '@/prompts/generate_cron_schedule_v1.yaml'
import generateDescription from '@/prompts/generate_description_v3.yaml'
import generateFaqFromRecord from '@/prompts/generate_faq_from_record_v1.yaml'
import generateInstructionFromText from '@/prompts/generate_instruction_from_text_v3.yaml'
import generateJson from '@/prompts/generate_json_v1.yaml'
import generateText from '@/prompts/generate_text_v1.yaml'
import translateText from '@/prompts/translate_text_v1.yaml'

export const prompts = {
  '66c3e6aa-481c-478f-9ae6-cc9fe49660a6': translateText,
  '95faf3e5-5f78-46b3-a3f5-688dbabaedd5': generateText,
  '19458ef0-2988-468b-8759-4a88368a719c': generateJson,
  'fe331e28-b81c-4903-88c5-011873bd91a4': generateDescription,
  '910cc152-2e2f-4239-a6b4-c7c776a885aa': generateFaqFromRecord,
  '3a0358f9-ec23-4a9d-a29a-0dcc7df0d8a5': generateInstructionFromText,
  '863983fb-63ad-494a-8ade-1a6cfea94ad9': generateBackstoryFromText,
  'bfbf2b76-0722-4cc2-a65f-5027de4be28d': generateCronSchedule,
}

export const aliasToPromptIdMap = {
  '@translate': '66c3e6aa-481c-478f-9ae6-cc9fe49660a6',
  '@text': '95faf3e5-5f78-46b3-a3f5-688dbabaedd5',
  '@json': '19458ef0-2988-468b-8759-4a88368a719c',
  '@description': 'fe331e28-b81c-4903-88c5-011873bd91a4',
  '@dataset': '910cc152-2e2f-4239-a6b4-c7c776a885aa',
  '@record': '910cc152-2e2f-4239-a6b4-c7c776a885aa',
  '@ability': '3a0358f9-ec23-4a9d-a29a-0dcc7df0d8a5',
  '@instruction': '3a0358f9-ec23-4a9d-a29a-0dcc7df0d8a5',
  '@backstory': '863983fb-63ad-494a-8ade-1a6cfea94ad9',
  '@schedule': 'bfbf2b76-0722-4cc2-a65f-5027de4be28d',
}

export const promptIdToAliasMap = {
  '66c3e6aa-481c-478f-9ae6-cc9fe49660a6': '@translate',
  '95faf3e5-5f78-46b3-a3f5-688dbabaedd5': '@text',
  '19458ef0-2988-468b-8759-4a88368a719c': '@json',
  'fe331e28-b81c-4903-88c5-011873bd91a4': '@description',
  '910cc152-2e2f-4239-a6b4-c7c776a885aa': '@record',
  '3a0358f9-ec23-4a9d-a29a-0dcc7df0d8a5': '@ability',
  '863983fb-63ad-494a-8ade-1a6cfea94ad9': '@backstory',
  'bfbf2b76-0722-4cc2-a65f-5027de4be28d': '@schedule',
}
