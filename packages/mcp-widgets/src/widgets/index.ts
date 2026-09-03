/**
 * Widgets Index
 *
 * Re-export all widgets for library usage
 */

// Web Component widget (no React dependency)
export { DataCardElement, register as registerDataCard } from './data-card'
export type { StatusType as DataCardStatusType } from './data-card'

// React widget
export { RichDataCard } from './rich-data-card'
export type {
  RichDataCardProps,
  Section,
  StatusType as RichDataCardStatusType,
} from './rich-data-card'
