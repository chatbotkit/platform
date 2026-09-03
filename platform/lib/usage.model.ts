import { baseLanguageModel } from '@/config/models'

import type { User } from '@/prisma/types'

import debug from '@/lib/debug'
import { captureObservation } from '@/lib/error'
import {
  convertLanguageModelTokenCount,
  getBaseImageModelTokenCount,
  getBaseLanguageModelTokenCount,
  getBaseVideoModelTokenCount,
  getImageModelTokenRatio,
  getLanguageModelTokenRatio,
  getVideoModelTokenRatio,
  parseImageModel,
  parseLanguageModel,
  parseVideoModel,
} from '@/lib/model.utils'
import {
  type UsageReferences,
  recordLanguageTokenUsage,
} from '@/lib/usage.record'

type OperationType = 'default' | 'output' | 'input'

/**
 * A utility class for tracking usage.
 */
export class Usage {
  #baseToken: number = 0 // base model tokens used

  #lineItems: Array<{
    tokens: number
    model: string
    type: OperationType
    debit: number
    ratio: number
  }> = [] // changes made to the usage

  #recordUsageCount: number = 0 // number of times usage has been recorded

  /**
   * Get the token count.
   */
  get token() {
    return this.#baseToken
  }

  /**
   * Get the metadata associated with the usage.
   */
  get items() {
    return this.#lineItems
  }

  /**
   * Check if usage has already been recorded.
   */
  get hasRecorded() {
    return this.#recordUsageCount > 0
  }

  /**
   * Add a usage to the usage.
   */
  addUsage(usage: Usage) {
    debug(`adding usage`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,

      usage,
    }).log('usage.Usage.addUsage')

    this.#baseToken += usage.token

    this.#lineItems.push(...usage.items)
  }

  /**
   * Add tokens to the usage.
   */
  addTokens(tokens: number, model: string, type: OperationType = 'default') {
    debug(`adding tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,

      tokens,
      model,
      type,
    }).log('usage.Usage.addTokens')

    if (tokens <= 0) {
      debug(`no tokens to add`, { tokens }).log('usage.Usage.addTokens')

      return
    }

    const { name: modelName } = parseLanguageModel(model)

    const baseToken = getBaseLanguageModelTokenCount(model, tokens, type)

    const tokenRatio = getLanguageModelTokenRatio(model, type)

    this.#baseToken += baseToken

    this.#lineItems.push({
      tokens: tokens,
      model: modelName,
      type: type,
      debit: Math.max(1, baseToken),
      ratio: tokenRatio,
    })

    debug(`added tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,
    }).log('usage.Usage.addTokens')
  }

  /**
   * Add video tokens to the usage. Mirrors addTokens but uses the video model
   * calibration so that video usage rolls up into the same base-token line
   * items used for language model usage.
   */
  addVideoTokens(
    tokens: number,
    model: string,
    type: OperationType = 'default'
  ) {
    debug(`adding video tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,

      tokens,
      model,
      type,
    }).log('usage.Usage.addVideoTokens')

    if (tokens <= 0) {
      debug(`no tokens to add`, { tokens }).log('usage.Usage.addVideoTokens')

      return
    }

    const { name: modelName } = parseVideoModel(model)

    const baseToken = getBaseVideoModelTokenCount(model, tokens, type)

    const tokenRatio = getVideoModelTokenRatio(model, type)

    this.#baseToken += baseToken

    this.#lineItems.push({
      tokens: tokens,
      model: modelName,
      type: type,
      debit: Math.max(1, baseToken),
      ratio: tokenRatio,
    })

    debug(`added video tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,
    }).log('usage.Usage.addVideoTokens')
  }

  /**
   * Add image tokens to the usage. Mirrors addTokens but uses the image model
   * calibration so that image usage rolls up into the same base-token line
   * items used for language model usage.
   */
  addImageTokens(
    tokens: number,
    model: string,
    type: OperationType = 'default'
  ) {
    debug(`adding image tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,

      tokens,
      model,
      type,
    }).log('usage.Usage.addImageTokens')

    if (tokens <= 0) {
      debug(`no tokens to add`, { tokens }).log('usage.Usage.addImageTokens')

      return
    }

    const { name: modelName } = parseImageModel(model)

    const baseToken = getBaseImageModelTokenCount(model, tokens, type)

    const tokenRatio = getImageModelTokenRatio(model, type)

    this.#baseToken += baseToken

    this.#lineItems.push({
      tokens: tokens,
      model: modelName,
      type: type,
      debit: Math.max(1, baseToken),
      ratio: tokenRatio,
    })

    debug(`added image tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,
    }).log('usage.Usage.addImageTokens')
  }

  /**
   * Records the usage of the tokens. If a model is provided, we will attempt to
   * re-calibrate the tokens based on the model.
   *
   * @todo maybe set the counter to 0 and throw an error if subsequently used
   */
  async recordTokens({
    user,
    model,
    meta,
    references,
  }: {
    user: Pick<User, 'id'>
    model?: string
    meta?: Record<string, unknown>
    references?: UsageReferences
  }) {
    debug(`recording tokens`, {
      '#baseToken': this.#baseToken,
      '#lineItems': this.#lineItems,
      '#recordUsageCount': this.#recordUsageCount,

      user,
      model,
      meta,
      references,
    }).log('usage.Usage.recordTokens')

    if (this.hasRecorded) {
      debug(`usage has already been recorded once`)
        .log('usage.Usage.recordTokens')
        .log('critical.usage.Usage.recordTokens')
        .trace()

      await captureObservation('Usage recorded multiple times', {
        '#baseToken': this.#baseToken,
        '#lineItems': this.#lineItems,
        '#recordUsageCount': this.#recordUsageCount,

        user,
        model,
        meta,
        references,
      })
    }

    // @note defaults to baseLanguageModel if not provided

    const actualModel = model || baseLanguageModel

    // @note convert the base tokens to the target model tokens for recording

    const actualTokens = convertLanguageModelTokenCount(
      baseLanguageModel,
      this.#baseToken,
      actualModel
    )

    // @note we deliberately do not allow lineItems to be overridden
    // by the caller of this function in order to preserve integrity

    const actualMeta = { ...meta, lineItems: this.#lineItems }

    // @note get actual references

    const actualReferences = references

    debug(`actual usage to be recorded`, {
      actualTokens,
      actualModel,
      actualMeta,
      actualReferences,
    }).log('usage.Usage.recordTokens')

    this.#recordUsageCount += 1

    await recordLanguageTokenUsage({
      user: user,
      count: actualTokens,
      model: actualModel,
      meta: actualMeta,
      references: actualReferences,
    })
  }

  /**
   * Records the usage of the tokens as base model tokens.
   */
  async recordBaseTokens({
    user,
    meta,
    references,
  }: {
    user: Pick<User, 'id'>
    meta?: Record<string, unknown>
    references?: UsageReferences
  }) {
    return this.recordTokens({
      user: user,
      model: baseLanguageModel,
      meta: meta,
      references: references,
    })
  }

  /**
   * Get the value of the usage.
   */
  toValue() {
    return {
      token: this.#baseToken,
    }
  }

  /**
   * Get the value of the usage as a token model object.
   */
  toTokenModelObject() {
    return {
      token: this.#baseToken,
      model: baseLanguageModel,
    }
  }

  /**
   * Create a new Usage instance from a token count and model.
   */
  static fromTokenAndModel(
    token: number,
    model: string,
    type: OperationType = 'default'
  ) {
    const usage = new Usage()

    usage.addTokens(token, model, type)

    return usage
  }

  /**
   * Utility function to create a usage and immediately record it.
   */
  static async createAndRecord({
    user,
    token,
    model,
    type = 'default',
    meta,
    references,
  }: {
    user: Pick<User, 'id'>
    token: number
    model: string
    type?: OperationType
    meta?: Record<string, unknown>
    references?: UsageReferences
  }) {
    const usage = Usage.fromTokenAndModel(token, model, type)

    await usage.recordBaseTokens({ user, meta, references })

    return usage
  }
}
