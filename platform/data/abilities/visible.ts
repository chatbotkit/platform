import '@/lib/scope.server'

import type { AbilityTemplate } from '@/data/abilities/all'
import all from '@/data/abilities/all'

import { omit } from '@/lib/object'

const visible: Record<string, AbilityTemplate> = omit(all, [/^\./])

export default visible

export type { AbilityTemplate }
