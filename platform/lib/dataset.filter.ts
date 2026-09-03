import { FilterSchema as StoreFilterSchema } from '@/lib/store.filter'

import type { z } from 'zod'

/**
 * @note DatasetFilterSchema is aliased to StoreFilterSchema because datasets
 * store their records in a Store (a vector store backend), and filtering
 * dataset records means filtering at the store level. The filter queries record
 * metadata fields using operators like $eq, $ne, $gt, $gte, $lt, $lte. This
 * alias provides semantic clarity while maintaining the same underlying
 * filtering mechanism used across all stores.
 */
export const DatasetFilterSchema = StoreFilterSchema

export type DatasetFilter = z.infer<typeof DatasetFilterSchema>
