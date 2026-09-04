// @note the realtime channel contract.
//
// The platform runs conversations where two parties need a live, bidirectional
// link that neither of them can host: a browser and a model runner, a meeting
// bot and the page it is streaming to, a phone call and the process answering
// it. Neither end can accept an inbound connection, so both dial out to a
// meeting point and are joined there. Where that meeting point is, is a
// deployment's choice.
//
// The contract is one function, and the smallness is the design rather than an
// omission. What the platform actually needs is an address it can hand to each
// side; everything after that happens over the socket, between two parties this
// module never sees. There is no `connect`, no `send`, and no server here,
// because nothing in the platform ever holds the connection - it mints two URLs
// and hands them to a browser and a runner.
//
// That is also what makes the seam worth having. The three call sites this
// replaced were byte-identical copies of the same URL construction, in three
// files that had nothing else to do with each other, each parsing the same
// environment variable. A backend change would have had to find all three.

/**
 * @note a caller's name for a meeting point, not an identifier this module
 * issues. The platform generates it - it is the thing that correlates a channel
 * with the conversation that caused it, which is knowledge no relay has. The
 * implementation's job is making two sides that quote the same name meet.
 */
export type RelayChannelId = string

/**
 * Which end of the channel is dialling in.
 *
 * @note an open string rather than a closed set, because the platform names its
 * own ends and the names differ per feature. What a relay does with it is pair
 * exactly two distinct sides on the same channel; it does not need to know that
 * one of them is a browser.
 */
export type RelayChannelSide = string

export interface RelayChannelOptions {
  /**
   * Subscribe this side to the channel's own lifecycle messages - the peer
   * connecting, the peer going away, keepalives.
   *
   * @note off by default, and worth being deliberate about. A side that only
   * relays payloads should not have to filter out messages that are about the
   * channel rather than from its peer. The sides that ask for it are the ones
   * that have to stay open across a peer reconnecting.
   */
  events?: boolean
}

// --- errors ---

export type RelayErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_OPERATION'
  | 'VALIDATION_FAILED'

/**
 * @note branded structurally rather than by class, for the reasons the other
 * contracts in this repository give: spec packages hold no behaviour, and
 * `instanceof` across a bundle boundary is a bet on module identity.
 */
export interface RelayErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly relay: true

  readonly code: RelayErrorCode

  /** The underlying failure, for logs. */
  readonly detail?: string
}

// --- provider ---

export interface RelayProvider {
  /**
   * The address a given side should dial to join a channel.
   *
   * @note synchronous, and that is a promise the contract makes rather than an
   * accident of the current implementation. Every caller builds these inside a
   * response it is already composing - two of them, one per side - and an
   * implementation that needed a round trip here would turn creating a
   * conversation into waiting on a third party. A backend that must reserve
   * something before it can answer should reserve it lazily, when a side
   * actually dials.
   *
   * The returned URL carries a websocket scheme. Callers hand it to a browser
   * or a runner unchanged.
   *
   * @throws `NOT_CONFIGURED` when no meeting point is available, which is the
   * honest answer for a deployment with no relay installed - see the note on
   * the community default.
   */
  channelUrl(
    channelId: RelayChannelId,
    side: RelayChannelSide,
    options?: RelayChannelOptions
  ): string

  /**
   * Host a meeting point in this process, when the implementation is one that
   * can.
   *
   * @note called once at server start. The platform is the one long-lived
   * process a single-node deployment has, so an implementation whose relay is
   * a process rather than a service can run it here and needs no second
   * container. An implementation whose meeting point is elsewhere resolves
   * and does nothing - the contract asks the question, it does not require a
   * yes. What it must not do is throw for lack of anything to host: that is
   * `assertConfigured`'s job.
   */
  listen(): Promise<void>

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
