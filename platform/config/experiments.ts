/* eslint-disable import/no-anonymous-default-export */

/**
 * Centralized A/B testing and feature experiment configuration.
 *
 * Each experiment is defined with a percentage value (0-100) representing
 * the percentage of traffic to include in the experiment.
 *
 * Set to 0 to disable, 100 to enable for everyone.
 *
 * @note no types set to ensure typescript correctly infers the experiment keys
 */
export default {
  /**
   * Chunking Experiment
   *
   * When enabled, large skillset responses are split into chunks and the
   * _readChunk internal function is exposed to retrieve individual chunks. This
   * helps manage context window limits for large responses.
   */
  'conversation.engine.chunking': 20,
}
