import type { ReplacementCoordinates } from '@/lib/string'
import { replaceWithCoordinates } from '@/lib/string'

interface RedactionStep {
  begin: number
  end: number
}

type RedactEntitiesResult = [string, ...RedactionStep[]]

export function redactEntities(
  text: string,
  entities: Record<string, string>
): RedactEntitiesResult {
  // get replacement steps

  const steps = replaceWithCoordinates(text, Object.entries(entities))

  // @note the helper returns the coordinate records followed by the final
  // output string. TypeScript cannot narrow `pop` on that shape, so the split
  // is done explicitly.

  const output = steps[steps.length - 1] as string

  const coordinates = steps.slice(0, -1) as ReplacementCoordinates[]

  // remove input and output from steps

  const outputSteps = coordinates.map(({ begin, end }) => ({ begin, end }))

  // return the output and the steps

  return [output, ...outputSteps]
}

export function unredactEntities(
  text: string,
  entities: Record<string, string>
): string {
  Object.entries(entities).forEach(([real, redacted]) => {
    text = text.replaceAll(redacted, real)
  })

  return text
}

interface EntityInput {
  text: string
  replacement: { text: string }
}

export function simplifyEntities(
  entities: EntityInput[]
): Record<string, string> {
  const output: Record<string, string> = {}

  for (const { text, replacement } of entities) {
    output[text] = replacement.text
  }

  return output
}
