export type DecisionInput = string | Record<string, unknown> | unknown[]

export type DecisionQuestion =
  | {
      type: 'boolean'
      instructions: DecisionInput
      criteria?: {
        true: DecisionInput | null
        false: DecisionInput | null
      }
    }
  | {
      type: 'choice'
      instructions: DecisionInput
      criteria: Record<string, DecisionInput | null>
    }
  | {
      type: 'score'
      instructions: DecisionInput
      criteria: (DecisionInput | null)[]
    }

export type DecisionAnswer =
  | { type: 'boolean'; probability: number }
  | { type: 'choice'; choice: string; probabilities?: Record<string, number> }
  | { type: 'score'; score: number; probabilities?: Record<string, number> }

export interface DecisionUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

export interface CreateDecisionOptions {
  state: DecisionInput

  questions: Record<string, DecisionQuestion>

  model: string
  modelOptions?: Record<string, unknown>

  signal?: AbortSignal
}

export interface CreateDecisionResult {
  answers: Record<string, DecisionAnswer>
  usage: DecisionUsage
}
