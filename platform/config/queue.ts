// @note the delivery secret that lets trusted tooling call a queued route
// directly - the trigger scripts use it to replay an event or poke a stuck
// conversation, and the local delivery path attaches it so the route it just
// called can tell the request was ours.
//
// It is deployment configuration rather than part of the queue contract. Which
// queue is installed has nothing to do with it: the secret authenticates the
// platform to itself, and it is checked here before any queue is consulted.
//
// It used to be a literal in this file, in the tree that gets published, with a
// note saying it should be an environment variable. It is one now.

/**
 * @note comma separated so that two values can be valid at once, which is what
 * rotating one without downtime needs.
 */
export const SECRETS = (process.env.QUEUE_SECRET || '')
  .split(',')
  .map((secret) => secret.trim())
  .filter(Boolean)
