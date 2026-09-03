import '@/lib/scope.server'

import { omit } from '@/lib/object'

import type { SecretTemplate } from './all'
import all from './all'

const visible: Record<string, SecretTemplate> = omit(all, [/^\./])

export default visible

export type { SecretTemplate }
