// The list is deployment configuration, not code: it is read from the
// ADMINS_CONFIG environment variable as JSON. Without it there are no
// administrators at all.
//
// ADMINS_CONFIG shape - an array of administrator identifiers:
//
//     ["ops@example.com", "clxyz0000000000000000000n"]
//
// An entry is a user id or an email address, with no way to tell which - and
// that is the existing behaviour rather than a new looseness. The check that
// reads this compares both fields of the signed-in user against every entry,
// so an email here promotes whoever currently holds that address and an id
// promotes one particular account for as long as it exists. The distinction
// matters when adding an entry: an email is a claim about a person, an id is
// a claim about an account, and only the second survives the person changing
// their address.
import { z } from 'zod'

const adminsSchema = z.array(z.string().min(1))

/**
 * The administrators, each named by user id or email address.
 *
 * @note an unordered list rather than a set, because it is written by hand
 * and read a handful of times per request. Duplicates are harmless.
 */
export type Admins = z.infer<typeof adminsSchema>

// @note a malformed ADMINS_CONFIG fails loudly on purpose - an admin list that
// silently no-ops would lock every administrator out without saying why
const admins: Admins = adminsSchema.parse(
  process.env.ADMINS_CONFIG ? JSON.parse(process.env.ADMINS_CONFIG) : []
)

export default admins
