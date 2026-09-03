import './styles.css'

const STATUS_STYLES = {
  success: { borderColor: '#22c55e', bgColor: '#f0fdf4', iconColor: '#16a34a' },
  error: { borderColor: '#ef4444', bgColor: '#fef2f2', iconColor: '#dc2626' },
  warning: { borderColor: '#f59e0b', bgColor: '#fffbeb', iconColor: '#d97706' },
  info: { borderColor: '#3b82f6', bgColor: '#eff6ff', iconColor: '#2563eb' },
} as const

export type StatusType = keyof typeof STATUS_STYLES

export interface Section {
  title: string
  data: Record<string, unknown>
}

export interface RichDataCardProps {
  /** Title displayed at the top of the card */
  title?: string
  /** Description text below the title */
  description?: string
  /** Icon/emoji to display in the header */
  icon?: string
  /** Main data to display as key-value pairs */
  data?: Record<string, unknown>
  /** Named sections with their own data */
  sections?: Section[]
  /** Footer text */
  footer?: string
  /** Status indicator */
  status?: StatusType
  /** Additional CSS class */
  className?: string
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

function DataList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return <p className="rdc-empty">No data available</p>
  }

  return (
    <div className="rdc-data-list">
      {entries.map(([key, value]) => (
        <div key={key} className="rdc-data-row">
          <span className="rdc-data-key">{formatKey(key)}</span>
          <span className="rdc-data-value">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Rich Data Card Widget - An enhanced React widget for displaying structured data
 *
 * Features:
 * - Title with optional icon
 * - Description text
 * - Main data section
 * - Multiple named sections
 * - Status indicator
 * - Footer
 */
export function RichDataCard({
  title,
  description,
  icon,
  data,
  sections,
  footer,
  status,
}: RichDataCardProps) {
  const statusStyle = status ? STATUS_STYLES[status] : null

  const cardStyle = statusStyle
    ? {
        borderColor: statusStyle.borderColor,
        backgroundColor: statusStyle.bgColor,
      }
    : undefined

  return (
    <div className="rdc-card" style={cardStyle}>
      {/* Header */}
      {(title || icon) && (
        <div className="rdc-header">
          {icon && <span className="rdc-icon">{icon}</span>}
          <div className="rdc-header-text">
            {title && <h3 className="rdc-title">{title}</h3>}
            {description && <p className="rdc-description">{description}</p>}
          </div>
        </div>
      )}

      {/* Main data section */}
      {data && (
        <div className="rdc-section">
          <DataList data={data} />
        </div>
      )}

      {/* Named sections */}
      {sections?.map((section, index) => (
        <div key={index} className="rdc-section rdc-section-named">
          <h4 className="rdc-section-title">{section.title}</h4>
          <DataList data={section.data} />
        </div>
      ))}

      {/* Footer */}
      {footer && <div className="rdc-footer">{footer}</div>}
    </div>
  )
}
