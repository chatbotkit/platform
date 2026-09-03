/**
 * Data Card Widget - A pure Web Component for displaying structured data
 *
 * This widget demonstrates how to build a self-contained web component
 * that can be used in any framework or vanilla HTML. No React dependency.
 *
 * @example
 * ```html
 * <mcp-data-card
 *   title="Weather"
 *   data='{"temperature": "72°F", "conditions": "Sunny"}'
 *   status="success"
 * ></mcp-data-card>
 * ```
 */

const STATUS_STYLES = {
  success: { border: '#22c55e', bg: '#f0fdf4' },
  error: { border: '#ef4444', bg: '#fef2f2' },
  warning: { border: '#f59e0b', bg: '#fffbeb' },
  info: { border: '#3b82f6', bg: '#eff6ff' },
} as const

export type StatusType = keyof typeof STATUS_STYLES

export class DataCardElement extends HTMLElement {
  private shadow: ShadowRoot

  static get observedAttributes() {
    return ['title', 'data', 'status']
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback() {
    this.render()
  }

  private get cardTitle(): string | null {
    return this.getAttribute('title')
  }

  private get data(): Record<string, unknown> | null {
    const dataAttr = this.getAttribute('data')
    if (!dataAttr) return null
    try {
      const parsed = JSON.parse(dataAttr)
      // Validate: must be a plain object (not array, not null)
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        console.warn(
          '[mcp-data-card] Invalid data: expected object, got',
          typeof parsed
        )
        return null
      }
      return parsed as Record<string, unknown>
    } catch (err) {
      console.warn('[mcp-data-card] Invalid JSON in data attribute:', err)
      return null
    }
  }

  private get status(): StatusType | null {
    const status = this.getAttribute('status')
    if (status && !(status in STATUS_STYLES)) {
      console.warn(
        `[mcp-data-card] Invalid status: "${status}". Expected: ${Object.keys(STATUS_STYLES).join(', ')}`
      )
      return null
    }
    return status && status in STATUS_STYLES ? (status as StatusType) : null
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toLocaleString()
    if (typeof value === 'string') return value
    if (Array.isArray(value))
      return value.map((v) => this.formatValue(v)).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim()
  }

  private render() {
    const statusStyle = this.status ? STATUS_STYLES[this.status] : null
    const borderColor = statusStyle?.border || '#e5e7eb'
    const bgColor = statusStyle?.bg || '#ffffff'

    const dataEntries = this.data ? Object.entries(this.data) : []

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .card {
          background: ${bgColor};
          border: 1px solid ${borderColor};
          border-radius: 12px;
          padding: 16px;
          max-width: 400px;
        }

        .title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .data-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .data-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .data-key {
          font-size: 13px;
          color: #6b7280;
          flex-shrink: 0;
        }

        .data-value {
          font-size: 13px;
          color: #111827;
          text-align: right;
          word-break: break-word;
        }

        .empty {
          font-size: 13px;
          color: #9ca3af;
          font-style: italic;
        }
      </style>

      <div class="card">
        ${this.cardTitle ? `<h3 class="title">${this.cardTitle}</h3>` : ''}
        ${
          dataEntries.length > 0
            ? `
          <div class="data-list">
            ${dataEntries
              .map(
                ([key, value]) => `
              <div class="data-row">
                <span class="data-key">${this.formatKey(key)}</span>
                <span class="data-value">${this.formatValue(value)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : '<p class="empty">No data available</p>'
        }
      </div>
    `
  }
}

/**
 * Register the custom element
 */
export function register(tagName = 'mcp-data-card') {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, DataCardElement)
  }
}
