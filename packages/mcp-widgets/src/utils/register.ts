/**
 * Component Registration Utilities
 *
 * Helpers for registering React components as Web Components (Custom Elements).
 */

import React from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * Options for registering a React component as a custom element
 */
export interface RegisterOptions<P> {
  /** The custom element tag name (must include a hyphen) */
  tagName: string
  /** List of attributes to observe and pass as props */
  observedAttributes?: string[]
  /** Whether to use Shadow DOM (default: false) */
  shadow?: boolean
  /** Custom function to transform attributes to props */
  attributeToProps?: (attrs: Record<string, string | null>) => Partial<P>
}

/**
 * Register a React component as a custom element
 *
 * This is a lightweight alternative to @r2wc/react-to-web-component
 * optimized for our use case.
 */
export function registerComponent<P extends object>(
  Component: React.ComponentType<P>,
  options: RegisterOptions<P>
): void {
  const {
    tagName,
    observedAttributes = [],
    shadow = false,
    attributeToProps,
  } = options

  class ReactElement extends HTMLElement {
    private root: Root | null = null
    private mountPoint: HTMLElement | null = null

    static get observedAttributes(): string[] {
      return observedAttributes
    }

    connectedCallback(): void {
      // Create mount point
      if (shadow) {
        const shadowRoot = this.attachShadow({ mode: 'open' })
        this.mountPoint = document.createElement('div')
        shadowRoot.appendChild(this.mountPoint)
      } else {
        this.mountPoint = this
      }

      this.root = createRoot(this.mountPoint)
      this.render()
    }

    disconnectedCallback(): void {
      if (this.root) {
        this.root.unmount()
        this.root = null
      }
    }

    attributeChangedCallback(): void {
      this.render()
    }

    private getProps(): P {
      const attrs: Record<string, string | null> = {}

      // Collect all observed attributes
      for (const attr of observedAttributes) {
        attrs[attr] = this.getAttribute(attr)
      }

      // Use custom transformer if provided
      if (attributeToProps) {
        return attributeToProps(attrs) as P
      }

      // Default: convert kebab-case attributes to camelCase props
      const props: Record<string, unknown> = {}
      for (const attr of observedAttributes) {
        const value = attrs[attr]
        if (value !== null) {
          // Convert kebab-case to camelCase
          const propName = attr.replace(/-([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          )
          // Try to parse JSON values
          try {
            props[propName] = JSON.parse(value)
          } catch {
            props[propName] = value
          }
        }
      }

      return props as P
    }

    private render(): void {
      if (!this.root) return
      const props = this.getProps()
      this.root.render(React.createElement(Component, props))
    }
  }

  // Only register if not already defined
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ReactElement)
  }
}
