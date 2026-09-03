/**
 * Widget Type Definitions
 */

import type { WidgetManifest } from './manifest'

/**
 * Base props that all MCP widgets receive
 */
export interface MCPWidgetProps {
  /** The tool name this widget is rendering for */
  toolName?: string
  /** Additional class names */
  className?: string
}

/**
 * Widget definition for internal use
 */
export interface WidgetDefinition<P extends MCPWidgetProps> {
  /** The React component */
  Component: React.ComponentType<P>
  /** The widget manifest */
  manifest: WidgetManifest
}
