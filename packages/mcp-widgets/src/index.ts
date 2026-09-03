/**
 * MCP Widgets
 *
 * This package provides UI widgets for MCP (Model Context Protocol)
 * integrations, particularly for rendering tool outputs in ChatGPT and
 * other AI assistants.
 *
 * @packageDocumentation
 */

// Re-export utilities
export * from './utils/index'

// Re-export types
export * from './types/index'

// Widgets are exported individually from their directories
// e.g., import { MapView } from 'mcp-widgets/widgets/map'

// Loaders are distributed via CDN only (cdn/loaders/*.js)
// They're browser-only and designed to be loaded via script tags
