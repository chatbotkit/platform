// @note built-in blacklists the platform enforces for every deployment. Not a
// swappable configuration module - the lists ship with the platform and are
// maintained for everyone. See src/domains.ts for the signup domain list.

import { domains } from './domains'

export { domains }

export interface Blacklist {
  /** Email domains refused at signup. */
  domains: string[]
}

const blacklist: Blacklist = {
  domains,
}

export default blacklist
