import { createModeration } from '@/lib/model.provider.openai'

export async function detectContentAbuse(text: string) {
  return await createModeration(text)
}
